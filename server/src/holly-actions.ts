import { defineAction,z,type Ctx } from "./sdk.js";
import { randomBytes,scrypt,timingSafeEqual,createHash,createPublicKey,verify } from "node:crypto";
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
const infoSchema=z.object({code:z.string(),count:z.number(),limit:z.number(),earned:z.number(),signupBonus:z.number(),pending:z.number()});
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
 return {code:u.referralCode,count:r?.n??0,limit:REFERRAL_LIMIT,earned:r?.earned??0,signupBonus:u.signupReward,pending:u.pendingBonus};
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
async function newAccount(db:Tx,args:{name:string,email:string,salt:string,passwordHash:string,referralCode:string,googleSub?:string}){
 let invitedBy:string|null=null;
 if(args.referralCode){
  const [inviter]=await db.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.referralCode,args.referralCode));
  if(!inviter)throw Error("Kode referral tidak ditemukan.");
  if((await referral(db,inviter)).count>=REFERRAL_LIMIT)throw Error("Kuota referral sudah habis (10/10).");
  invitedBy=inviter.id;
  await db.update(schema.hollyAccounts).set({pendingBonus:sql`${schema.hollyAccounts.pendingBonus}+${INVITER_REWARD}`}).where(eq(schema.hollyAccounts.id,inviter.id));
 }
 const [u]=await db.insert(schema.hollyAccounts).values({id:randomBytes(16).toString("hex"),name:args.name,email:args.email,salt:args.salt,passwordHash:args.passwordHash,googleSub:args.googleSub??null,emailVerified:!!args.googleSub,referralCode:"HL"+randomBytes(5).toString("hex").toUpperCase(),invitedBy,inviterReward:invitedBy?INVITER_REWARD:0,signupReward:invitedBy?NEW_ACCOUNT_REWARD:0,pendingBonus:invitedBy?NEW_ACCOUNT_REWARD:0}).returning();
 return u!;
}
const googleClaims=z.object({iss:z.enum(["accounts.google.com","https://accounts.google.com"]),aud:z.string(),azp:z.string().optional(),exp:z.number().int(),iat:z.number().int(),nonce:z.string(),sub:z.string().min(1).max(255),email:z.string().email().max(254),email_verified:z.literal(true),name:z.string().optional()});
async function googleIdentity(token:string,nonce:string){
 const clientId=process.env.HOLLY_GOOGLE_CLIENT_ID;
 if(!clientId)throw Error("Login Google belum dikonfigurasi.");
 try{
  const parts=token.split(".");
  if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw Error("token");
  const header=z.object({alg:z.literal("RS256"),kid:z.string().min(1).max(200)}).parse(JSON.parse(Buffer.from(parts[0]!,"base64url").toString("utf8")));
  const claims=googleClaims.parse(JSON.parse(Buffer.from(parts[1]!,"base64url").toString("utf8")));
  const now=Math.floor(Date.now()/1000);
  if(claims.aud!==clientId||(claims.azp&&claims.azp!==clientId)||claims.exp<=now||claims.iat>now+60||claims.iat<now-600||claims.nonce!==nonce)throw Error("claims");
  const res=await fetch("https://www.googleapis.com/oauth2/v3/certs",{signal:AbortSignal.timeout(5000)});
  if(!res.ok)throw Error("keys");
  const jwks=z.object({keys:z.array(z.object({kid:z.string(),kty:z.literal("RSA"),n:z.string(),e:z.string(),alg:z.string().optional(),use:z.string().optional()}))}).parse(await res.json());
  const jwk=jwks.keys.find(k=>k.kid===header.kid&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
  if(!jwk||!verify("RSA-SHA256",Buffer.from(parts[0]+"."+parts[1]),createPublicKey({key:{kty:"RSA",n:jwk.n,e:jwk.e},format:"jwk"}),Buffer.from(parts[2]!,"base64url")))throw Error("signature");
  return {sub:claims.sub,email:claims.email.trim().toLowerCase(),name:(claims.name?.trim()||"Orang tua").slice(0,50)};
 }catch{throw Error("Login Google gagal diverifikasi. Silakan coba lagi.");}
}
export const hollyActions={
 hollySignup:defineAction({request:authInput.extend({name:z.string().trim().min(2).max(50),adult:z.literal(true),referralCode:z.string().trim().toUpperCase().regex(/^(?:HL[A-F0-9]{10})?$/).default("")}),response:loginOut,async handler(ctx,args){
   const salt=randomBytes(16).toString("hex");const passwordHash=(await derive(args.password,salt,64) as Buffer).toString("hex");
   return dbOf(ctx).transaction(async db=>{
    await lock(db);if((await db.select({id:schema.hollyAccounts.id}).from(schema.hollyAccounts).where(eq(schema.hollyAccounts.email,args.email))).length)throw Error("Email sudah terdaftar. Silakan masuk.");
    const u=await newAccount(db,{name:args.name,email:args.email,salt,passwordHash,referralCode:args.referralCode});
    return login(db,u,args.sessionToken);
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
 hollyGoogleChallenge:defineAction({request:z.object({}),response:z.object({clientId:z.string(),nonce:z.string()}),async handler(ctx){
    const clientId=process.env.HOLLY_GOOGLE_CLIENT_ID;
    if(!clientId||!clientId.endsWith(".apps.googleusercontent.com"))throw Error("Login Google belum dikonfigurasi.");
    const nonce=randomBytes(24).toString("hex"), db=dbOf(ctx);
    await db.transaction(async tx=>{
      await tx.delete(schema.hollyGoogleChallenges).where(lt(schema.hollyGoogleChallenges.expiresAt,new Date()));
      await tx.insert(schema.hollyGoogleChallenges).values({hash:hash(nonce),expiresAt:new Date(Date.now()+600000)});
    });
    return {clientId,nonce};
 }}),
 hollyGoogleSignin:defineAction({request:z.object({sessionToken:tokenSchema,nonce:z.string().regex(/^[a-f0-9]{48}$/),credential:z.string().min(30).max(16384),adult:z.literal(true),referralCode:z.string().trim().toUpperCase().regex(/^(?:HL[A-F0-9]{10})?$/).default("")}),response:loginOut,async handler(ctx,args){
    const google=await googleIdentity(args.credential,args.nonce);
    const db=dbOf(ctx);
    return db.transaction(async tx=>{
      await lock(tx);
      const consumed=await tx.delete(schema.hollyGoogleChallenges).where(and(eq(schema.hollyGoogleChallenges.hash,hash(args.nonce)),gt(schema.hollyGoogleChallenges.expiresAt,new Date()))).returning();
      if(!consumed.length)throw Error("Sesi Google kedaluwarsa. Muat ulang halaman.");
      const [known]=await tx.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.googleSub,google.sub));
      if(known)return login(tx,known,args.sessionToken);
      const [collision]=await tx.select().from(schema.hollyAccounts).where(eq(schema.hollyAccounts.email,google.email));
      if(collision)throw Error("Email ini sudah terdaftar. Masuk menggunakan email dan password akun lama. Akun tidak digabung otomatis.");
      const salt=randomBytes(16).toString("hex");
      const passwordHash=(await derive(randomBytes(32).toString("hex"),salt,64) as Buffer).toString("hex");
      const u=await newAccount(tx,{name:google.name,email:google.email,salt,passwordHash,referralCode:args.referralCode,googleSub:google.sub});
      return login(tx,u,args.sessionToken);
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
