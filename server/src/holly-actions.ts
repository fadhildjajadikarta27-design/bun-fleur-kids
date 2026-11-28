import { defineAction,z,type Ctx } from "./sdk.js";
import { randomBytes,scrypt,timingSafeEqual,createHash } from "node:crypto";
import { promisify } from "node:util";
import { eq,and,gt,lt,count,sql } from "drizzle-orm";
const INVITER_REWARD=500, NEW_ACCOUNT_REWARD=1000, REFERRAL_LIMIT=10;
import * as schema from "./schema.js";
const derive=promisify(scrypt);
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/).or(z.literal(""));
const authInput=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(10).max(128),sessionToken:tokenSchema.default("")});
const dbOf=(ctx:Ctx)=>ctx.db<typeof schema>();
type Db=ReturnType<typeof dbOf>;type Tx=Parameters<Parameters<Db["transaction"]>[0]>[0];
type Account=typeof schema.hollyAccounts.$inferSelect;
const crop=z.enum(["wortel","stroberi","matahari"]);
const number=z.number().int().min(0).max(1000000000);
const progressSchema=z.object({v:z.literal(1),coins:number,sales:number,harvest:number,upgrades:z.array(z.string().max(40)).max(10),plots:z.array(z.object({stage:z.number().int().min(0).max(3),crop:crop.optional(),readyAt:z.number().nonnegative().max(1e14).optional()}).refine(p=>p.stage===0||!!p.crop).refine(p=>p.stage!==2||p.readyAt!==undefined)).min(4).max(8),stock:z.object({wortel:number,stroberi:number,matahari:number}),order:z.partialRecord(crop,z.number().int().min(1).max(10)).nullable()});
const fresh=()=>({v:1 as const,coins:0,sales:0,harvest:0,upgrades:[],plots:Array.from({length:4},()=>({stage:0})),stock:{wortel:0,stroberi:0,matahari:0},order:null});
const infoSchema=z.object({code:z.string(),count:z.number(),limit:z.number(),earned:z.number(),signupBonus:z.number(),pending:z.number(),emailVerified:z.boolean(),awaitingVerification:z.boolean()});
const profileSchema=z.object({name:z.string(),email:z.string(),progress:progressSchema.nullable(),revision:z.number(),referral:infoSchema});
const loginOut=z.object({user:profileSchema,sessionToken:z.string()});
async function lock(db:Tx){await db.execute(sql`SELECT pg_advisory_xact_lock(82134809)`);}
async function session(db:Db|Tx,token:string){
 if(!token)return undefined;
 const [s]=await db.select().from(schema.hollySessions).where(and(eq(schema.hollySessions.hash,hash(token)),gt(schema.hollySessions.expiresAt,new Date())));
 if(!s)return undefined;
 return (await db.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.id,s.accountId)))[0];
}
async function referral(db:Db|Tx,u:Account){
 const [r]=await db.select({n:count(),earned:sql<number>`COALESCE(SUM(${schema.hollyAccounts.inviterReward}),0)::int`}).from(schema.hollyAccounts).where(and(eq(schema.hollyAccounts.invitedBy,u.id),gt(schema.hollyAccounts.inviterReward,0)));
 return {code:u.referralCode,count:r?.n??0,limit:REFERRAL_LIMIT,earned:r?.earned??0,signupBonus:u.signupReward,pending:u.pendingBonus,emailVerified:u.emailVerified,awaitingVerification:!!u.invitedBy&&!u.emailVerified};
}
async function profile(db:Db|Tx,u:Account){return {name:u.name,email:u.email,progress:u.progress==null?null:progressSchema.parse(u.progress),revision:u.revision,referral:await referral(db,u)};}
async function applyPending(db:Tx,u:Account){
 if(!u.pendingBonus)return u;
 const p=u.progress==null?fresh():progressSchema.parse(u.progress);
 p.coins+=u.pendingBonus;
 const [r]=await db.update(schema.hollyAccounts).set({progress:progressSchema.parse(p),pendingBonus:0,revision:u.revision+1}).where(eq(schema.hollyAccounts.id,u.id)).returning();return r!;
}
async function login(db:Tx,u:Account,old:string){
 if(old)await db.delete(schema.hollySessions).where(eq(schema.hollySessions.hash,hash(old)));
 await db.delete(schema.hollySessions).where(lt(schema.hollySessions.expiresAt,new Date()));
 const token=randomBytes(32).toString("hex");
 await db.insert(schema.hollySessions).values({hash:hash(token),accountId:u.id,expiresAt:new Date(Date.now()+7*86400000)});
 return {user:await profile(db,await applyPending(db,u)),sessionToken:token};
}
export const hollyActions={
 hollySignup:defineAction({request:authInput.extend({name:z.string().trim().min(2).max(50),adult:z.literal(true),referralCode:z.string().trim().toUpperCase().regex(/^(?:HL[A-F0-9]{10})?$/).default("")}),response:loginOut,async handler(ctx,args){
   const salt=randomBytes(16).toString("hex");const passwordHash=(await derive(args.password,salt,64) as Buffer).toString("hex");
   return dbOf(ctx).transaction(async db=>{
    await lock(db);if((await db.select({id:schema.hollyAccounts.id}).from(schema.hollyAccounts).where(eq(schema.hollyAccounts.email,args.email))).length)throw Error("Email sudah terdaftar. Silakan masuk.");
    let invitedBy:string|null=null;
    if(args.referralCode){
      const [inviter]=await db.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.referralCode,args.referralCode));
      if(!inviter)throw Error("Kode referral tidak ditemukan.");
      if((await referral(db,inviter)).count>=REFERRAL_LIMIT)throw Error("Kuota referral sudah habis (10/10).");
      invitedBy=inviter.id;

    }
    const [u]=await db.insert(schema.hollyAccounts).values({id:randomBytes(16).toString("hex"),name:args.name,email:args.email,salt,passwordHash,referralCode:"HL"+randomBytes(5).toString("hex").toUpperCase(),invitedBy,pendingBonus:0}).returning();
    return login(db,u!,args.sessionToken);
   });
 }}),
 hollySignin:defineAction({request:authInput,response:loginOut,async handler(ctx,args){
   const db=dbOf(ctx);const [u]=await db.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.email,args.email));
   const derived=await derive(args.password,u?.salt??"00000000000000000000000000000000",64) as Buffer;
   if(!u||!timingSafeEqual(derived,Buffer.from(u.passwordHash,"hex")))throw Error("Email atau password salah.");
   return db.transaction(async tx=>{await lock(tx);const [current]=await tx.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.id,u.id));return login(tx,current!,args.sessionToken);});
 }}),
 hollyMe:defineAction({request:z.object({sessionToken:tokenSchema}),response:z.object({user:profileSchema.nullable()}),async handler(ctx,args){return dbOf(ctx).transaction(async db=>{await lock(db);const u=await session(db,args.sessionToken);return {user:u?await profile(db,await applyPending(db,u)):null};});}}),
 hollyReferral:defineAction({request:z.object({sessionToken:tokenSchema}),response:z.object({referral:infoSchema}),async handler(ctx,args){const db=dbOf(ctx),u=await session(db,args.sessionToken);if(!u)throw Error("Silakan masuk kembali.");return {referral:await referral(db,u)};}}),
 hollySignout:defineAction({request:z.object({sessionToken:tokenSchema}),response:z.object({ok:z.boolean()}),async handler(ctx,args){if(args.sessionToken)await dbOf(ctx).delete(schema.hollySessions).where(eq(schema.hollySessions.hash,hash(args.sessionToken)));return {ok:true};}}),
 hollySendVerification:defineAction({request:z.object({sessionToken:tokenSchema}),response:z.object({ok:z.boolean()}),async handler(ctx,args){
   const key=process.env.HOLLY_RESEND_API_KEY,from=process.env.HOLLY_EMAIL_FROM;
   if(!key||!from)throw Error("Layanan verifikasi email belum dikonfigurasi.");
   const db=dbOf(ctx);
   const pending=await db.transaction(async tx=>{
     await lock(tx);const u=await session(tx,args.sessionToken);if(!u)throw Error("Silakan masuk kembali.");
     if(u.emailVerified)return null;
     if(u.verificationSentAt&&Date.now()-u.verificationSentAt.getTime()<60000)throw Error("Tunggu satu menit sebelum mengirim ulang.");
     const code=randomBytes(24).toString("hex");
     await tx.update(schema.hollyAccounts).set({verificationHash:hash(code),verificationExpiresAt:new Date(Date.now()+1800000),verificationSentAt:new Date()}).where(eq(schema.hollyAccounts.id,u.id));
     return {id:u.id,email:u.email,code};
   });
   if(!pending)return {ok:true};
   const link="https://bunandfleurkids.fun/holly-luna/index.html#verify="+pending.code;
   try {
     const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:JSON.stringify({from,to:[pending.email],subject:"Verifikasi email Holly & Luna",text:"Verifikasi akun orang tua melalui tautan berikut (berlaku 30 menit): "+link+"\n\nJika tidak meminta verifikasi, abaikan pesan ini."}),signal:AbortSignal.timeout(8000)});
     if(!r.ok)throw Error("Email belum terkirim.");
   } catch {
     await db.update(schema.hollyAccounts).set({verificationHash:null,verificationExpiresAt:null,verificationSentAt:null}).where(and(eq(schema.hollyAccounts.id,pending.id),eq(schema.hollyAccounts.verificationHash,hash(pending.code))));
     throw Error("Email belum terkirim. Coba lagi nanti.");
   }
   return {ok:true};
 }}),
 hollyVerifyEmail:defineAction({request:z.object({sessionToken:tokenSchema,code:z.string().regex(/^[a-f0-9]{48}$/)}),response:z.object({referral:infoSchema}),async handler(ctx,args){
   return dbOf(ctx).transaction(async db=>{
     await lock(db);const u=await session(db,args.sessionToken);if(!u)throw Error("Silakan masuk ke akun yang sesuai.");
     if(u.emailVerified)return {referral:await referral(db,u)};
     if(!u.verificationHash||u.verificationHash!==hash(args.code)||!u.verificationExpiresAt||u.verificationExpiresAt.getTime()<=Date.now())throw Error("Tautan verifikasi tidak valid atau kedaluwarsa.");
     let inviterReward=0,signupReward=0;
     if(u.invitedBy&&u.inviterReward===0){
       const [inviter]=await db.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.id,u.invitedBy));
       if(inviter&&(await referral(db,inviter)).count<REFERRAL_LIMIT){
         inviterReward=INVITER_REWARD;signupReward=NEW_ACCOUNT_REWARD;
         await db.update(schema.hollyAccounts).set({pendingBonus:sql`${schema.hollyAccounts.pendingBonus}+${inviterReward}`}).where(eq(schema.hollyAccounts.id,inviter.id));
       }
     }
     const [verified]=await db.update(schema.hollyAccounts).set({emailVerified:true,verificationHash:null,verificationExpiresAt:null,inviterReward:u.inviterReward||inviterReward,signupReward:u.signupReward||signupReward,pendingBonus:sql`${schema.hollyAccounts.pendingBonus}+${signupReward}`}).where(eq(schema.hollyAccounts.id,u.id)).returning();
     return {referral:await referral(db,verified!)};
   });
 }}),
 hollyProgress:defineAction({request:z.object({sessionToken:tokenSchema,progress:progressSchema,revision:number}),response:z.object({revision:z.number(),bonusAdded:z.number(),referral:infoSchema}),async handler(ctx,args){
   return dbOf(ctx).transaction(async db=>{await lock(db);const u=await session(db,args.sessionToken);if(!u)throw Error("Silakan masuk kembali.");if(u.revision!==args.revision)throw Error("Progres berubah di tab lain. Muat ulang sebelum lanjut.");
   const progress=progressSchema.parse({...args.progress,coins:args.progress.coins+u.pendingBonus});
   const [r]=await db.update(schema.hollyAccounts).set({progress,pendingBonus:0,revision:u.revision+1}).where(eq(schema.hollyAccounts.id,u.id)).returning();
   return {revision:r!.revision,bonusAdded:u.pendingBonus,referral:await referral(db,r!)};
   });
 }})
};
