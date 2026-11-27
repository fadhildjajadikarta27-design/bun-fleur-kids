import { defineAction, z, type Ctx } from "./sdk.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import * as schema from "./schema.js";

export const PLAY_GROUPS = [
 ["bubbles","peek","hello","follow","big"],
 ["feed","bath","dress","shape","color"],
 ["count","pair","sort","rhythm","animal"],
 ["maze","memory","pattern","puzzle","routine"],
 ["adventure","math","letters","logic","story"]
] as const;
const gameIds = PLAY_GROUPS.flat();
const gameId = z.string().refine(v => (gameIds as readonly string[]).includes(v), "Game tidak ditemukan.");
const categoryId = z.string().regex(/^category-[0-4]$/);
const target = z.union([gameId,categoryId]);
const purchaseOut = z.object({code:z.string(),target:z.string(),amount:z.number(),status:z.enum(["pending","reported","paid","cancelled","refunded"]),paymentReference:z.string().nullable(),createdAt:z.string()});
type Purchase=typeof schema.gamePurchases.$inferSelect;
const toPurchase=(p:Purchase)=>({code:p.code,target:p.target,amount:p.amount,status:p.status,paymentReference:p.paymentReference,createdAt:p.createdAt.toISOString()});
const dbOf=(ctx:Ctx)=>ctx.db<typeof schema>();
type Db=ReturnType<typeof dbOf>;
type Tx=Parameters<Parameters<Db["transaction"]>[0]>[0];
function owner(ctx:Ctx){if(!ctx.visitorId)throw new Error("Sesi tidak tersedia. Muat ulang halaman.");return ctx.visitorId;}
function covers(p:Purchase,id:string){return p.status==="paid" && (p.target===id || p.target==="category-"+PLAY_GROUPS.findIndex(g=>(g as readonly string[]).includes(id)));}
async function purchases(db:Db|Tx,visitorId:string){return db.select().from(schema.gamePurchases).where(eq(schema.gamePurchases.ownerId,visitorId)).orderBy(desc(schema.gamePurchases.createdAt));}
const accessOut=z.object({unlocked:z.boolean(),remainingSeconds:z.number().int().nonnegative(),started:z.boolean()});
const TRIAL_SECONDS=900;
const remaining=(expires:Date)=>Math.max(0,Math.ceil((expires.getTime()-Date.now())/1000));

export const playActions={
 getGameAccess:defineAction({
  request:z.object({}),response:z.object({games:z.array(accessOut.extend({gameId:z.string()})),purchases:z.array(purchaseOut)}),
  async handler(ctx){
   const id=owner(ctx),db=dbOf(ctx);
   const [trials,orders]=await Promise.all([db.select().from(schema.gameTrials).where(eq(schema.gameTrials.ownerId,id)),purchases(db,id)]);
   return {games:gameIds.map(gameId=>{const row=trials.find(t=>t.gameId===gameId);return {gameId,unlocked:orders.some(p=>covers(p,gameId)),remainingSeconds:row?remaining(row.expiresAt):TRIAL_SECONDS,started:!!row};}),purchases:orders.map(toPurchase)};
  }
 }),
 startGameTrial:defineAction({
  request:z.object({gameId}),response:accessOut,
  async handler(ctx,args){
   const id=owner(ctx),db=dbOf(ctx);
   if((await purchases(db,id)).some(p=>covers(p,args.gameId)))return {unlocked:true,remainingSeconds:0,started:true};
   const key=id+":"+args.gameId;
   await db.insert(schema.gameTrials).values({key,ownerId:id,gameId:args.gameId,expiresAt:new Date(Date.now()+TRIAL_SECONDS*1000)}).onConflictDoNothing();
   const [row]=await db.select().from(schema.gameTrials).where(eq(schema.gameTrials.key,key));
   if(!row)throw new Error("Trial belum bisa dimulai.");
   return {unlocked:false,remainingSeconds:remaining(row.expiresAt),started:true};
  }
 }),
 createGamePurchase:defineAction({
  request:z.object({target,adultConfirmed:z.literal(true)}),response:z.object({purchase:purchaseOut}),
  async handler(ctx,args){
   const id=owner(ctx);
   return dbOf(ctx).transaction(async db=>{
    await db.execute(sql`SELECT pg_advisory_xact_lock(82134791)`);
    const rows=await purchases(db,id);
    const category=args.target.startsWith("category-");
    const ids=category?PLAY_GROUPS[Number(args.target.slice(9))]!: [args.target];
    if(ids.every(g=>rows.some(p=>covers(p,g))))throw new Error("Akses ini sudah aktif.");
    const old=rows.find(p=>p.target===args.target&&["pending","reported"].includes(p.status));
    if(old)return {purchase:toPurchase(old)};
    const [row]=await db.insert(schema.gamePurchases).values({code:"PLAY-"+randomBytes(8).toString("hex").toUpperCase(),ownerId:id,target:args.target,amount:category?29000:10000,status:"pending",createdAt:new Date(),updatedAt:new Date()}).returning();
    if(!row)throw new Error("Pembelian belum dibuat.");
    return {purchase:toPurchase(row)};
   });
  }
 }),
 reportGamePayment:defineAction({
  request:z.object({code:z.string().regex(/^PLAY-[A-F0-9]{16}$/),paymentReference:z.string().trim().regex(/^[A-Za-z0-9-]{4,80}$/),adultConfirmed:z.literal(true)}),response:z.object({purchase:purchaseOut}),
  async handler(ctx,args){
   const id=owner(ctx),db=dbOf(ctx);
   const [row]=await db.update(schema.gamePurchases).set({status:"reported",paymentReference:args.paymentReference.toUpperCase(),updatedAt:new Date()}).where(and(eq(schema.gamePurchases.ownerId,id),eq(schema.gamePurchases.code,args.code),eq(schema.gamePurchases.status,"pending"))).returning();
   if(row)return {purchase:toPurchase(row)};
   const [old]=await db.select().from(schema.gamePurchases).where(and(eq(schema.gamePurchases.ownerId,id),eq(schema.gamePurchases.code,args.code)));
   if(old&&["reported","paid"].includes(old.status))return {purchase:toPurchase(old)};
   throw new Error("Pembelian tidak ditemukan atau sudah dibatalkan.");
  }
 }),
 adminListGamePurchases:defineAction({
  request:z.object({offset:z.number().int().nonnegative().default(0)}),response:z.object({purchases:z.array(purchaseOut),paidRevenue:z.number()}),
  async handler(ctx,args){
   const db=dbOf(ctx);
   const rows=await db.select().from(schema.gamePurchases).orderBy(desc(schema.gamePurchases.createdAt)).limit(50).offset(args.offset);
   const [sum]=await db.select({total:sql<number>`coalesce(sum(amount),0)`.mapWith(Number)}).from(schema.gamePurchases).where(eq(schema.gamePurchases.status,"paid"));
   return {purchases:rows.map(toPurchase),paidRevenue:sum?.total??0};
  }
 }),
 adminVerifyGamePurchase:defineAction({
  request:z.object({code:z.string().regex(/^PLAY-[A-F0-9]{16}$/),decision:z.enum(["verify","cancel","refund"]),paidAmount:z.number().int().nonnegative().optional(),paymentReference:z.string().trim().max(80).optional()}),response:z.object({purchase:purchaseOut}),
  async handler(ctx,args){
   return dbOf(ctx).transaction(async db=>{
    await db.execute(sql`SELECT pg_advisory_xact_lock(82134791)`);
    const [row]=await db.select().from(schema.gamePurchases).where(eq(schema.gamePurchases.code,args.code)).for("update");
    if(!row)throw new Error("Pembelian tidak ditemukan.");
    let status:Purchase["status"],ref=row.paymentReference;
    if(args.decision==="verify"){
     if(row.status==="paid")return {purchase:toPurchase(row)};
     if(row.status!=="reported")throw new Error("Pembayaran belum dilaporkan.");
     ref=(args.paymentReference??"").toUpperCase();
     if(!/^[A-Z0-9-]{4,80}$/.test(ref)||ref!==row.paymentReference||args.paidAmount!==row.amount)throw new Error("Cocokkan nominal penuh dan referensi dari mutasi QRIS.");
     const [physical]=await db.select({id:schema.orders.id}).from(schema.orders).where(eq(schema.orders.paymentReference,ref)).limit(1);
     const [birthday]=await db.select({id:schema.birthdayEvents.id}).from(schema.birthdayEvents).where(eq(schema.birthdayEvents.paymentReference,ref)).limit(1);
     const [other]=await db.select({code:schema.gamePurchases.code}).from(schema.gamePurchases).where(and(eq(schema.gamePurchases.paymentReference,ref),sql`status IN ('paid','refunded')`)).limit(1);
     if(physical||birthday||other)throw new Error("Referensi pembayaran sudah digunakan.");
     status="paid";
    }else if(args.decision==="cancel"&&["pending","reported"].includes(row.status)){status="cancelled";}
    else if(args.decision==="refund"&&row.status==="paid"){status="refunded";}
    else throw new Error("Perubahan status tidak diizinkan.");
    const [updated]=await db.update(schema.gamePurchases).set({status,paymentReference:ref,updatedAt:new Date()}).where(eq(schema.gamePurchases.code,row.code)).returning();
    await db.insert(schema.affiliateAudit).values({affiliateId:null,action:"game."+status,detail:row.code,createdAt:new Date()});
    return {purchase:toPurchase(updated!)};
   });
  }
 })
};
