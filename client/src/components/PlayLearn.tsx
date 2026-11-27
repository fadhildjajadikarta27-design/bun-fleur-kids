import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "../api";
import { officialQrisUrl } from "../official-qris";
import { formatIDR } from "../lib/shop";
import { ArtworkSvg, type Stroke } from "./ColoringEditor";
import { AGE_BANDS, getTemplate } from "../lib/registry";
import { buildCustomTemplate, parseCustomDef } from "../lib/custom";
import type { WorkProject } from "../App";

type Choice = { prompt: string; items: string[]; answer: number };
type Game = { id: string; name: string; hint: string; mode: "pop"|"reveal"|"tap"|"move"|"choice"|"memory"|"sequence"|"maze"; rounds?: Choice[]; tokens?: string[]; target?: number };
const q = (prompt:string,items:string[],answer:number):Choice=>({prompt,items,answer});
export const GAMES: Game[][] = [
 [
  {id:"bubbles",name:"Bubble Pop",hint:"Sentuh lingkaran besar bersama orang tua.",mode:"pop",tokens:["●","●","●","●"],target:4},
  {id:"peek",name:"Peek-a-Boo",hint:"Temukan karakter di balik selimut.",mode:"reveal",target:3},
  {id:"hello",name:"Hello, Little Friend",hint:"Sentuh karakter untuk menyapa.",mode:"tap",target:3},
  {id:"follow",name:"Follow Me",hint:"Ikuti karakter yang berpindah tempat.",mode:"move",target:4},
  {id:"big",name:"Bola Besar",hint:"Tunjuk bola yang lebih besar.",mode:"choice",rounds:[q("Mana bola yang besar?",["●","⚫"],1),q("Mana bola yang besar?",["⚫","●"],0)]}
 ],
 [
  {id:"feed",name:"Feed My Friend",hint:"Pilih makanan untuk temanmu.",mode:"choice",rounds:[q("Berikan apel.",["🍎","🚗"],0),q("Berikan pisang.",["🧸","🍌"],1),q("Berikan wortel.",["🥕","⚽"],0)]},
  {id:"bath",name:"Bath Time",hint:"Bantu teman mandi.",mode:"choice",rounds:[q("Pilih sabun.",["🧼","🚗"],0),q("Pilih air.",["🧸","💧"],1),q("Pilih handuk.",["🧺","🍎"],0)]},
  {id:"dress",name:"Dress Up",hint:"Pilih pakaian yang diminta.",mode:"choice",rounds:[q("Pilih topi.",["🧢","👟"],0),q("Pilih sepatu.",["👕","👟"],1),q("Pilih baju.",["👕","🧢"],0)]},
  {id:"shape",name:"Shape Match",hint:"Cocokkan bentuk sederhana.",mode:"choice",rounds:[q("Pilih lingkaran ○.",["○","□"],0),q("Pilih kotak □.",["△","□"],1),q("Pilih segitiga △.",["△","○"],0)]},
  {id:"color",name:"Color Hunt",hint:"Cari warna yang disebutkan.",mode:"choice",rounds:[q("Cari merah.",["🔴","🔵"],0),q("Cari biru.",["🟡","🔵"],1),q("Cari kuning.",["🟡","🟢"],0)]}
 ],
 [
  {id:"count",name:"Count the Fruit",hint:"Hitung buah untuk temanmu.",mode:"choice",rounds:[q("Berapa apel? 🍎 🍎",["1","2","3"],1),q("Berapa pisang? 🍌",["1","2","3"],0),q("Berapa jeruk? 🍊 🍊 🍊",["1","2","3"],2)]},
  {id:"pair",name:"Find My Pair",hint:"Cari dua kartu yang sama.",mode:"memory",tokens:["🍎","🐱","🚗"]},
  {id:"sort",name:"Tidy Up",hint:"Pilih benda sesuai kelompok.",mode:"choice",rounds:[q("Mana buah?",["🚗","🍓","🧸"],1),q("Mana kendaraan?",["🚲","🍎","🐱"],0),q("Mana hewan?",["🧢","🍌","🐰"],2)]},
  {id:"rhythm",name:"Tap the Rhythm",hint:"Ulangi urutan ketukan.",mode:"sequence",tokens:["●","○","●"]},
  {id:"animal",name:"Animal Friends",hint:"Temukan hewan yang disebut.",mode:"choice",rounds:[q("Cari kelinci.",["🐰","🐱","🐟"],0),q("Cari ikan.",["🐶","🐟","🐦"],1),q("Cari burung.",["🐱","🐭","🐦"],2)]}
 ],
 [
  {id:"maze",name:"Little Explorer",hint:"Gerakkan karakter menuju rumah.",mode:"maze",target:3},
  {id:"memory",name:"Memory Garden",hint:"Balik dan pasangkan kartu.",mode:"memory",tokens:["🌷","🍎","🐝","🍃"]},
  {id:"pattern",name:"Pattern Train",hint:"Lengkapi pola berikutnya.",mode:"choice",rounds:[q("🔴 🔵 🔴 🔵 ...",["🔵","🔴","🟡"],1),q("△ ○ △ ○ ...",["○","□","△"],2),q("🍎 🍌 🍎 🍌 ...",["🍎","🍌","🍊"],0)]},
  {id:"puzzle",name:"Picture Match",hint:"Cocokkan bagian dengan gambar utuh.",mode:"choice",rounds:[q("Mana bentuk yang cocok dengan □?",["○","△","□"],2),q("Mana bagian dari pohon?",["🍃","🚗","👟"],0),q("Mana bagian dari wajah?",["🧢","👃","🍎"],1)]},
  {id:"routine",name:"My Daily Routine",hint:"Susun kegiatan harian.",mode:"sequence",tokens:["Bangun","Mandi","Sarapan","Bermain"]}
 ],
 [
  {id:"adventure",name:"My Little Adventure",hint:"Bawa karakter melewati jalan menuju rumah.",mode:"maze",target:5},
  {id:"math",name:"Fruit Math",hint:"Penjumlahan kecil dengan buah.",mode:"choice",rounds:[q("🍎 🍎 + 🍎 = ?",["2","3","4"],1),q("🍌 🍌 + 🍌 🍌 = ?",["4","3","5"],0),q("🍊 🍊 🍊 + 🍊 🍊 = ?",["3","4","5"],2)]},
  {id:"letters",name:"Letter Safari",hint:"Cari huruf pertama kata.",mode:"choice",rounds:[q("Huruf awal APEL?",["B","A","C"],1),q("Huruf awal BOLA?",["B","D","A"],0),q("Huruf awal KUCING?",["M","S","K"],2)]},
  {id:"logic",name:"Little Thinker",hint:"Temukan benda yang berbeda.",mode:"choice",rounds:[q("Mana yang bukan buah?",["🍎","🍌","🚗","🍊"],2),q("Mana yang bukan hewan?",["🧸","🐱","🐶","🐰"],0),q("Mana bentuk berbeda?",["○","○","□","○"],2)]},
  {id:"story",name:"Story Builder",hint:"Susun urutan cerita sederhana.",mode:"sequence",tokens:["Tanam benih","Siram air","Tumbuh daun","Bunga mekar"]}
 ]
];

function Avatar({project}:{project:WorkProject}) {
  const def=project.templateId==="custom"?parseCustomDef(project.customDef):null;
  const template=def?buildCustomTemplate(def):getTemplate(project.templateId);
  return <ArtworkSvg template={template} colors={project.colors} strokes={project.strokes} name={project.childName} nameFont={project.nameFont} nameColor={project.nameColor} nameAlign={project.nameAlign} showLabel={false}/>;
}
const tile="min-h-20 rounded-2xl border border-[#D9E5D2] bg-white p-3 text-center font-display font-bold text-olive-deep shadow-sm focus-visible:outline-2 focus-visible:outline-olive";
function GameBoard({game,avatar,onBack}:{game:Game;avatar:ReactNode;onBack:()=>void}) {
  const [round,setRound]=useState(0),[feedback,setFeedback]=useState(""),[done,setDone]=useState(false);
  const [popped,setPopped]=useState<number[]>([]),[hidden,setHidden]=useState(true),[position,setPosition]=useState(0);
  const [opened,setOpened]=useState<number[]>([]),[matched,setMatched]=useState<number[]>([]);
  const [run,setRun]=useState(0);
  const deck=useMemo(()=>{const base=game.tokens??[];return [...base,...base].map((v,i)=>({v,i})).sort((a,b)=>((a.i*7+3+run)% (base.length*2||1))-((b.i*7+3+run)% (base.length*2||1))).map(x=>x.v)},[game.tokens,run]);
  const steps=game.tokens??[];
  const finish=()=>{setDone(true);setFeedback("Hebat, kita berhasil!");};
  const advance=(limit:number)=>{setFeedback("Bagus!");if(round+1>=limit)finish();else setRound(r=>r+1);};
  const reset=()=>{setRound(0);setFeedback("");setDone(false);setPopped([]);setHidden(true);setPosition(0);setOpened([]);setMatched([]);setRun(n=>n+1);};
  const choice=game.rounds?.[round];
  const gridSize=game.target??3;
  const goal=gridSize*gridSize-1;
  const path=Array.from({length:gridSize*gridSize},(_,i)=>i).filter(i=>Math.floor(i/gridSize)%2===0||i%gridSize===(Math.floor(i/gridSize)%4===1?gridSize-1:0));
  const openCard=(i:number)=>{if(matched.includes(i)||opened.includes(i))return;
    if(opened.length===2){setOpened([i]);return;}
    const next=[...opened,i];setOpened(next);
    if(next.length===2){if(deck[next[0]!]===deck[next[1]!]){const all=[...matched,...next];setMatched(all);setOpened([]);setFeedback("Pasangan ditemukan!");if(all.length===deck.length)finish();}else setFeedback("Coba pasangan lain.");}};
  return <section className="rounded-[2rem] bg-[#E7F3FB] p-4 sm:p-6" aria-label={game.name}>
    <button type="button" onClick={onBack} className="rounded-full bg-white px-4 py-2 text-sm font-bold">← Semua game</button>
    <h2 className="mt-3 text-center font-display text-3xl font-bold text-olive-deep">{game.name}</h2>
    <p className="text-center text-sm">{game.hint}</p>
    {game.mode!=="maze"&&game.mode!=="reveal"&&game.mode!=="tap"&&game.mode!=="move"&&<div className="mx-auto mt-3 w-28 rounded-2xl bg-white p-2">{avatar}</div>}
    {done?<div className="mt-5 rounded-2xl bg-white p-6 text-center"><h3 className="font-display text-2xl font-bold">Hebat!</h3><p>Permainan selesai. Kamu dan temanmu berhasil.</p><button type="button" onClick={reset} className="mt-4 rounded-full bg-olive px-6 py-3 font-bold text-white">Main lagi</button></div>:
    <div className="mt-4 space-y-4">
    {game.mode==="choice"&&choice&&<><p className="text-center font-display text-xl font-bold">{choice.prompt}</p><div className="grid grid-cols-2 gap-3">{choice.items.map((item,i)=><button type="button" key={i} className={tile+" text-3xl"} onClick={()=>i===choice.answer?advance(game.rounds!.length):setFeedback("Coba lagi, tidak apa-apa.")}>{game.id==="big"?<span aria-label={item==="⚫"?"Bola besar":"Bola kecil"} style={{fontSize:item==="⚫"?72:32}}>●</span>:item}</button>)}</div></>}
    {game.mode==="pop"&&<div className="grid grid-cols-2 gap-3">{steps.map((_,i)=><button type="button" key={i} aria-label={"Gelembung "+(i+1)} disabled={popped.includes(i)} onClick={()=>{const next=[...popped,i];setPopped(next);if(next.length===steps.length)finish();}} className={tile+" h-28 text-5xl"} style={{background:popped.includes(i)?"#fff":["#B5DDF4","#F9D89F","#C8E3B2","#F5CAD7"][i]}}>{popped.includes(i)?"✓":"○"}</button>)}</div>}
    {game.mode==="reveal"&&<button type="button" className={tile+" mx-auto block w-full max-w-xs"} onClick={()=>{if(hidden){setHidden(false);advance(game.target??3);}else setHidden(true);}}>{hidden?<div className="flex h-40 items-center justify-center rounded-2xl bg-[#F6D6AF] text-xl">Buka selimut</div>:avatar}</button>}
    {game.mode==="tap"&&<button type="button" aria-label="Sapa karakter" className={tile+" mx-auto block w-48"} onClick={()=>advance(game.target??3)}>{avatar}<span>Halo!</span></button>}
    {game.mode==="move"&&<div className="grid grid-cols-2 gap-3">{Array.from({length:4},(_,i)=><button type="button" key={i} className={tile+" h-32"} aria-label={"Tempat "+(i+1)} onClick={()=>{if(i!==position)return;setPosition(p=>(p+1)%4);advance(game.target??4);}}>{position===i?<div className="mx-auto w-24">{avatar}</div>:""}</button>)}</div>}
    {game.mode==="memory"&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{deck.map((v,i)=><button type="button" key={i} aria-label={"Kartu "+(i+1)+(matched.includes(i)?" cocok":"")} className={tile+" text-3xl"} disabled={matched.includes(i)} onClick={()=>openCard(i)}>{opened.includes(i)||matched.includes(i)?v:"?"}</button>)}</div>}
    {game.mode==="sequence"&&<><p className="text-center text-sm">Ikuti urutan ini:</p><div className="flex flex-wrap justify-center gap-2">{steps.map((v,i)=><span key={i} className={"rounded-xl px-3 py-2 font-bold "+(i<round?"bg-[#C8E3B2]":"bg-white")}>{v}</span>)}</div><div className="grid grid-cols-2 gap-3">{[...new Set(steps)].reverse().map(v=><button type="button" key={v} className={tile} onClick={()=>v===steps[round]?advance(steps.length):setFeedback("Coba urutan berikutnya lagi.")}>{v}</button>)}</div></>}
    {game.mode==="maze"&&<><p className="text-center text-sm">Pilih kotak jalan yang bersebelahan untuk mencapai rumah.</p><div className="mx-auto grid max-w-md gap-1" style={{gridTemplateColumns:"repeat("+gridSize+",minmax(0,1fr))"}}>{Array.from({length:gridSize*gridSize},(_,i)=>{const allowed=path.includes(i);return <button type="button" key={i} disabled={!allowed} aria-label={"Kotak "+(i+1)} className={"aspect-square rounded-xl border text-2xl "+(allowed?"bg-white":"bg-[#A6C68F]")} onClick={()=>{if(Math.abs(Math.floor(i/gridSize)-Math.floor(position/gridSize))+Math.abs(i%gridSize-position%gridSize)!==1)return;setPosition(i);if(i===goal)finish();}}>{i===position?avatar:i===goal?"⌂":""}</button>})}</div></>}
    </div>}
    <p role="status" className="mt-3 text-center font-semibold text-olive-deep">{feedback}</p>
  </section>;
}
type Purchase=ApiResponse<typeof api,"getGameAccess">["purchases"][number];
const targetLabel=(target:string)=>target.startsWith("category-")?"Paket "+(AGE_BANDS[Number(target.slice(9))]?.label??target):GAMES.flat().find(g=>g.id===target)?.name??target;
function ParentCheckout({target,purchases,onClose}:{target:string;purchases:Purchase[];onClose:()=>void}){
 const qc=useQueryClient();
 const [confirmed,setConfirmed]=useState(false),[reference,setReference]=useState("");
 const existing=purchases.find(p=>p.target===target&&["pending","reported","paid"].includes(p.status));
 const create=useMutation({mutationFn:()=>api.createGamePurchase({target,adultConfirmed:true}),onSuccess:()=>qc.invalidateQueries({queryKey:["gameAccess"]})});
 const report=useMutation({mutationFn:(code:string)=>api.reportGamePayment({code,paymentReference:reference.trim(),adultConfirmed:true}),onSuccess:()=>qc.invalidateQueries({queryKey:["gameAccess"]})});
 const order=report.data?.purchase??existing??create.data?.purchase;
 return <section className="my-4 rounded-[2rem] bg-white p-5 ring-1 ring-[#D9E5D2]" aria-label="Pembelian untuk orang tua">
  <button type="button" onClick={onClose} className="rounded-full border px-4 py-2 text-sm font-bold">Tutup pembelian</button>
  <h2 className="mt-3 font-display text-2xl font-bold">Khusus Orang Tua</h2>
  <p className="mt-2 font-bold">{targetLabel(target)} · {formatIDR(target.startsWith("category-")?29000:10000)}</p>
  <p className="mt-2 text-sm">Sekali bayar, akses tanpa batas waktu pada browser yang sama. Jangan hapus cookie browser. Tidak ada langganan otomatis. Jika akses hilang, hubungi admin dengan bukti pembayaran.</p>
  {order?.status==="paid"?<p role="status" className="mt-3 font-bold text-olive-deep">Akses sudah aktif.</p>:order?.status==="reported"?<p role="status" className="mt-3 font-bold text-olive-deep">Pembayaran dilaporkan. Tunggu verifikasi admin. Jangan bayar ulang. Kode: {order.code}</p>:<>
    <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>Saya orang tua/wali dan menyetujui pembelian ini.</label>
    {!order?<button type="button" disabled={!confirmed||create.isPending} onClick={()=>create.mutate()} className="mt-4 rounded-full bg-olive px-5 py-3 font-bold text-white disabled:opacity-40">Buat tagihan</button>:<>
      <p className="mt-3 text-sm font-bold">Kode: {order.code}</p><img src={officialQrisUrl} alt="QRIS resmi Bun & Fleur Kids" className="mx-auto my-3 w-full max-w-[240px]"/>
      <p className="text-center font-display text-2xl font-bold">{formatIDR(order.amount)}</p><p className="mt-2 text-sm">Transfer nominal persis, lalu isi nomor referensi transaksi dari bukti pembayaran. Simpan kode dan bukti transfer.</p>
      <label className="mt-3 block text-sm font-bold">Referensi transaksi<input className="mt-1 block w-full rounded-xl border p-3" maxLength={80} value={reference} onChange={e=>setReference(e.target.value)} /></label>
      <button type="button" disabled={!confirmed||report.isPending||! /^[A-Za-z0-9-]{4,80}$/.test(reference.trim())} onClick={()=>report.mutate(order.code)} className="mt-3 rounded-full bg-olive px-5 py-3 font-bold text-white disabled:opacity-40">Saya sudah bayar</button>
    </>}
  </>}
  {(create.isError||report.isError)&&<p role="alert" className="mt-3 text-sm text-berry">{create.error?.message??report.error?.message}</p>}
 </section>;
}
export function PlayLearn({current,onColor}:{current:WorkProject;onColor:()=>void}) {
  const qc=useQueryClient();
  const projects=useQuery({queryKey:["projects"],queryFn:()=>api.listProjects({limit:50})});
  const access=useQuery({queryKey:["gameAccess"],queryFn:()=>api.getGameAccess({}),refetchOnWindowFocus:true,refetchInterval:30000});
  const hasArtwork=(p:WorkProject)=>Object.keys(p.colors).some(k=>p.colors[k]!=="#FFFFFF")||p.strokes.length>0;
  const saved=(projects.data?.projects??[]).map(p=>({...p,strokes:p.strokes as Stroke[]} as WorkProject)).filter(hasArtwork);
  const options=hasArtwork(current)?[current,...saved.filter(p=>p.id!==current.id)]:saved;
  const [selected,setSelected]=useState(0),[age,setAge]=useState(0),[game,setGame]=useState<Game|null>(null);
  const [deadline,setDeadline]=useState(0),[now,setNow]=useState(Date.now()),[paid,setPaid]=useState(false),[checkout,setCheckout]=useState<string|null>(null),[expired,setExpired]=useState<string|null>(null);
  const avatar=options[selected]??options[0];
  const launch=useMutation({mutationFn:(g:Game)=>api.startGameTrial({gameId:g.id}),onSuccess:(result,g)=>{
    setPaid(result.unlocked);setNow(Date.now());setDeadline(Date.now()+result.remainingSeconds*1000);
    if(result.unlocked||result.remainingSeconds>0){setGame(g);setExpired(null);setCheckout(null);}else{setGame(null);setExpired(g.id);}
    void qc.invalidateQueries({queryKey:["gameAccess"]});
  }});
  useEffect(()=>{if(!game||paid)return;const t=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(t);},[game,paid]);
  useEffect(()=>{if(game&&!paid&&deadline<=now){setExpired(game.id);setGame(null);void qc.invalidateQueries({queryKey:["gameAccess"]});}},[game,paid,deadline,now,qc]);
  useEffect(()=>{if(!game||!paid||!access.data)return;if(!access.data.games.find(g=>g.gameId===game.id)?.unlocked){setGame(null);setExpired(game.id);}},[game,paid,access.data]);
  const changeAge=(i:number)=>{setAge(i);setGame(null);setCheckout(null);setExpired(null)};
  const state=(g:Game)=>access.data?.games.find(x=>x.gameId===g.id);
  const packageOwned=GAMES[age]!.every(g=>state(g)?.unlocked);
  return <main className="mx-auto max-w-4xl px-4 pb-24 pt-5">
    <header className="rounded-[2rem] bg-[#EDF2E6] p-5"><h1 className="font-display text-3xl font-bold text-olive-deep">Play &amp; Learn</h1><p className="mt-2">Main bersama karakter yang sudah kamu warnai.</p><p className="mt-2 text-xs">Orang tua memilih aktivitas sesuai perkembangan anak. Untuk usia di bawah 18 bulan utamakan bermain langsung tanpa layar; usia 18–24 bulan hanya bersama pendamping. Tanpa iklan. Trial 15 menit dihitung sejak pertama membuka setiap game, bukan durasi bermain yang disarankan.</p></header>
    {!avatar?<div className="mt-4 rounded-2xl bg-white p-6 text-center"><p>{projects.isPending?"Memuat kreasimu…":"Warnai karakter dulu untuk mulai bermain."}</p><button type="button" onClick={onColor} className="mt-3 rounded-full bg-olive px-6 py-3 font-bold text-white">Pilih karakter</button></div>:<>
      <div className="mt-4 rounded-2xl bg-white p-4"><label className="font-bold" htmlFor="play-avatar">Pilih karakterku</label><select id="play-avatar" value={String(selected)} onChange={e=>{setSelected(Number(e.target.value));setGame(null);setExpired(null);setCheckout(null)}} className="ml-2 max-w-full rounded-xl border p-2">{options.map((p,i)=><option key={p.id??"current"} value={i}>{p.childName||getTemplate(p.templateId).name}</option>)}</select><div className="mx-auto mt-3 w-32"><Avatar project={avatar}/></div></div>
      <div className="my-4 flex flex-wrap gap-2" aria-label="Kategori umur">{AGE_BANDS.map((b,i)=><button key={b.id} type="button" disabled={launch.isPending} aria-pressed={age===i} onClick={()=>changeAge(i)} className={"rounded-full px-4 py-3 text-sm font-bold "+(age===i?"bg-olive text-white":"bg-white ring-1 ring-[#D9E5D2]")}>{b.label}</button>)}</div>
      {age===0&&<p className="mb-3 rounded-xl bg-[#FFF3D1] p-3 text-sm">Aktivitas contoh untuk orang tua: tirukan secara langsung dengan benda aman dan interaksi tatap muka. Bukan rekomendasi waktu layar untuk bayi.</p>}
      {access.isError&&<div role="alert" className="rounded-xl bg-white p-3">Akses permainan belum dapat dimuat. <button onClick={()=>void access.refetch()} className="font-bold underline">Coba lagi</button></div>}
      {launch.isError&&<p role="alert" className="mb-3 text-sm text-berry">{launch.error.message}</p>}
      {!game&&<section className="mb-4 rounded-2xl bg-[#EDF2E6] p-4"><p className="font-bold">Paket {AGE_BANDS[age]!.label} · 5 game</p><p className="text-sm">Rp29.000 sekali bayar · hemat Rp21.000 dibanding membeli satu per satu.</p><button disabled={!access.data||packageOwned} type="button" onClick={()=>setCheckout("category-"+age)} className="mt-2 rounded-full bg-olive px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{packageOwned?"Semua game sudah terbuka":"Pilihan pembelian orang tua"}</button></section>}
      {expired&&!game&&<section className="mb-4 rounded-2xl bg-white p-5"><h2 className="font-display text-xl font-bold">Waktu istirahat</h2><p>Sesi coba gratis sudah selesai. Orang tua dapat membuka akses {targetLabel(expired)}.</p><button type="button" onClick={()=>setCheckout(expired)} className="mt-3 rounded-full border px-4 py-2 font-bold">Orang tua: akses Rp10.000</button></section>}
      {checkout&&!game&&<ParentCheckout key={checkout} target={checkout} purchases={access.data?.purchases??[]} onClose={()=>{setCheckout(null);void access.refetch()}}/>}
      {game?<><p className="mb-2 text-xs text-[var(--dim)]">{paid?"Akses game aktif":"Sisa masa coba (orang tua): "+Math.max(0,Math.ceil((deadline-now)/1000/60))+" menit"}</p><GameBoard key={game.id+":"+selected} game={game} avatar={<Avatar project={avatar}/>} onBack={()=>setGame(null)}/></>:<div className="grid gap-3 sm:grid-cols-2">{GAMES[age]!.map(g=>{const info=state(g),locked=info?.started&&!info.unlocked&&info.remainingSeconds===0;return <article key={g.id} className="rounded-[1.75rem] bg-white p-5 ring-1 ring-[#D9E5D2]"><h2 className="font-display text-xl font-bold text-olive-deep">{g.name}</h2><p className="mt-1 text-sm">{g.hint}</p><button type="button" aria-label={g.name+" "+(locked?"Orang tua":"Mulai main")} disabled={!info||launch.isPending} onClick={()=>locked?setCheckout(g.id):launch.mutate(g)} className="mt-3 rounded-full bg-[#E7F3FB] px-4 py-2 font-bold disabled:opacity-40">{locked?"Orang tua · Rp10.000":"Mulai main"}</button><p className="mt-2 text-xs text-[var(--dim)]">{info?.unlocked?"Akses aktif":locked?"Trial selesai":"Gratis 15 menit · Rp10.000 setelah trial"}</p></article>})}</div>}
      {!!access.data?.purchases.length&&!game&&<details className="mt-4 rounded-xl bg-white p-4"><summary className="font-bold">Riwayat pembelian orang tua</summary>{access.data.purchases.map(p=><p key={p.code} className="mt-2 text-sm">{targetLabel(p.target)} · {formatIDR(p.amount)} · {p.status==="paid"?"Aktif":p.status==="reported"?"Menunggu verifikasi":p.status==="pending"?"Belum bayar":p.status==="refunded"?"Refund":"Dibatalkan"} · {p.code} {["pending","reported"].includes(p.status)&&<button className="underline" onClick={()=>setCheckout(p.target)}>Lihat tagihan</button>}</p>)}<button className="mt-2 rounded-full border px-4 py-2 font-bold" onClick={()=>void access.refetch()}>Cek status pembayaran</button></details>}
    </>}
  </main>;
}
export function GamePurchaseAdmin(){
 const qc=useQueryClient(),[offset,setOffset]=useState(0);
 const data=useQuery({queryKey:["adminGamePurchases",offset],queryFn:()=>api.adminListGamePurchases({offset})});
 const verify=useMutation({mutationFn:(args:Parameters<typeof api.adminVerifyGamePurchase>[0])=>api.adminVerifyGamePurchase(args),onSuccess:()=>qc.invalidateQueries({queryKey:["adminGamePurchases"]})});
 return <section className="rounded-3xl bg-white p-5"><h2 className="font-display text-2xl font-bold text-olive-deep">Pembelian Play &amp; Learn</h2><p className="mt-2 text-sm">Pendapatan game lunas: {formatIDR(data.data?.paidRevenue??0)}. Cocokkan mutasi QRIS sebelum verifikasi. Tidak masuk ledger komisi affiliate.</p>
 {data.isError&&<p role="alert">{data.error.message}</p>}{verify.isError&&<p role="alert">{verify.error.message}</p>}
 {data.data?.purchases.map(p=><article key={p.code} className="mt-3 rounded-xl border p-4"><p className="font-bold">{targetLabel(p.target)} · {formatIDR(p.amount)} · {p.status}</p><p className="text-sm break-all">{p.code} · Referensi: {p.paymentReference??"—"}</p>
 {p.status==="reported"&&<button disabled={verify.isPending} type="button" onClick={()=>{const reference=window.prompt("Masukkan referensi sesuai mutasi QRIS");if(!reference)return;const amount=window.prompt("Masukkan nominal aktual yang diterima (angka)");if(!amount||!window.confirm("Aktifkan akses setelah mutasi benar-benar cocok?"))return;verify.mutate({code:p.code,decision:"verify",paymentReference:reference,paidAmount:Number(amount)});}} className="mt-3 rounded-full bg-olive px-4 py-2 font-bold text-white">Verifikasi pembayaran</button>}
 {["pending","reported","paid"].includes(p.status)&&<button type="button" disabled={verify.isPending} onClick={()=>{if(window.confirm(p.status==="paid"?"Catat refund yang sudah dikirim dan cabut akses?":"Batalkan tagihan yang belum lunas?"))verify.mutate({code:p.code,decision:p.status==="paid"?"refund":"cancel"});}} className="ml-2 mt-3 rounded-full border px-4 py-2 font-bold">{p.status==="paid"?"Catat refund":"Batalkan"}</button>}
 </article>)}
 <div className="mt-4 flex gap-2"><button disabled={offset===0} onClick={()=>setOffset(o=>Math.max(0,o-50))} className="rounded-full border px-3 py-2 disabled:opacity-40">Sebelumnya</button><button disabled={(data.data?.purchases.length??0)<50} onClick={()=>setOffset(o=>o+50)} className="rounded-full border px-3 py-2 disabled:opacity-40">Berikutnya</button><button onClick={()=>void data.refetch()} className="rounded-full border px-3 py-2">Muat ulang</button></div></section>;
}
