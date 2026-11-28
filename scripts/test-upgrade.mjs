import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { ensureMigrations,closeDatabase } from "../server/src/db.ts";
const url=new URL(process.env.BFK_TEST_DATABASE_URL??"postgres://invalid/invalid");
if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname)||url.pathname!=="/bfk_audit_upgrade")throw new Error("Requires disposable local bfk_audit_upgrade database");
process.env.DATABASE_URL=url.href;
const db=postgres(url.href);
const files=readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort();
try{
 await db.begin(async tx=>{
  await tx`CREATE TABLE __port_migrations(name text PRIMARY KEY,applied_at bigint NOT NULL)`;
  for(const file of files.slice(0,10)){
   for(const sql of readFileSync("drizzle/"+file,"utf8").split("--> statement-breakpoint"))if(sql.trim())await tx.unsafe(sql);
   await tx`INSERT INTO __port_migrations VALUES (${file},${Date.now()})`;
  }
  // Synthetic fixture only. No real customer records or credentials.
  await tx`INSERT INTO affiliates(name,email,whatsapp,coupon_code,status,pin_hash,created_at,updated_at)
  SELECT 'QA '||i,'qa'||i||'@example.test','08123456'||lpad(i::text,4,'0'),'QA'||i,'active','synthetic-test-hash',now(),now() FROM generate_series(1,12) i`;
  await tx`INSERT INTO orders(code,template_id,product_type,product_price,total,customer_name,whatsapp,email,address,unique_code,created_at,updated_at)
  SELECT 'QA-OLD-'||i,'pb-dino','poster',24900,24900,'QA',CASE WHEN i=1 THEN '081234560001' WHEN i=2 THEN '+62 81234560002' ELSE '081234560099' END,'qa@example.test','Test only',i,now(),now() FROM generate_series(1,3) i`;
  await tx`INSERT INTO affiliate_sessions(affiliate_id,token,expires_at,created_at) SELECT 1,'qa-session-'||i,now()+interval '1 day',now() FROM generate_series(1,20) i`;
  await tx`INSERT INTO affiliate_invitations(affiliate_id,token,expires_at,created_at) VALUES(1,'qa-invite',now()+interval '1 day',now())`;
  await tx`INSERT INTO commissions(order_id,affiliate_id,net_subtotal,commission_pct,amount,status,created_at,updated_at) VALUES(1,1,24900,30,7470,'paid',now(),now()),(2,2,24900,30,7470,'pending',now(),now())`;
 });
 const oldAff=await db`SELECT id,name,email,whatsapp,coupon_code,status,pin_hash FROM affiliates ORDER BY id`;
 const oldOrders=await db`SELECT id,code,product_type,product_price,total,pay_state,unique_code FROM orders ORDER BY id`;
 await ensureMigrations();
 assert.deepEqual(await db`SELECT id,name,email,whatsapp,coupon_code,status,pin_hash FROM affiliates ORDER BY id`,oldAff);
 assert.deepEqual(await db`SELECT id,code,product_type,product_price,total,pay_state,unique_code FROM orders ORDER BY id`,oldOrders);
 assert.equal((await db`SELECT count(*)::int AS n FROM affiliate_sessions WHERE revoked_at IS NOT NULL AND token LIKE 'retired:%'`)[0].n,20);
 assert.equal((await db`SELECT count(*)::int AS n FROM affiliate_invitations WHERE revoked_at IS NOT NULL AND token LIKE 'retired:%'`)[0].n,1);
 assert.equal((await db`SELECT paid_amount FROM commissions WHERE order_id=1`)[0].paid_amount,7470);
 assert.deepEqual((await db`SELECT affiliate_self_order FROM orders ORDER BY id`).map(o=>o.affiliate_self_order),[true,true,false]);
 assert.deepEqual((await db`SELECT status FROM commissions ORDER BY order_id`).map(c=>c.status),["paid","reversed"]);
 assert.equal((await db`SELECT count(*)::int AS n FROM affiliate_audit WHERE action='commission.self_order_reversed'`)[0].n,1);
 assert.equal((await db`SELECT count(*)::int AS n FROM orders WHERE quantity=1 AND items='[]'::jsonb AND bundle_name='' AND gift IS NULL`)[0].n,3);
 const applied=await db`SELECT name FROM __port_migrations ORDER BY name`;
 assert.deepEqual(applied.map(x=>x.name),files);
 await closeDatabase();await ensureMigrations();
 assert.deepEqual(await db`SELECT name FROM __port_migrations ORDER BY name`,applied);
 for(const table of ["request_limits","payment_proofs","product_prices","product_costs","monthly_operating_costs","birthday_events","birthday_prices","shop_bundles","holly_accounts","holly_sessions"]){
  assert.equal((await db`SELECT has_table_privilege('anon',${"public."+table},'SELECT') AS allowed`)[0].allowed,false);
  assert.equal((await db`SELECT has_table_privilege('authenticated',${"public."+table},'SELECT') AS allowed`)[0].allowed,false);
 }
 console.log("PASS legacy upgrade: 12 affiliate accounts, 3 existing orders, paid commission preserved; old tokens retired; migration rerun idempotent; private table grants");
}finally{await db.end();await closeDatabase();}
