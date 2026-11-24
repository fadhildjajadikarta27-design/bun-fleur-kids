import { useRef,useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { api,type ApiResponse } from "../api";
import { PRODUCT_META,formatIDR } from "../lib/shop";
type EventRow=ApiResponse<typeof api,"listMyBirthdayEvents">["events"][number];
type AdminRow=ApiResponse<typeof api,"adminListBirthdayEvents">["events"][number];
type Status=EventRow["status"];
type Product=ApiResponse<typeof api,"getBirthdayCatalog">["products"][number];
const labels:Record<Status,string>={requested:"Menunggu konfirmasi",confirmed:"Dikonfirmasi",paid:"Lunas",production:"Sedang diproduksi",shipped:"Dikirim",completed:"Selesai",cancelled:"Dibatalkan",refunded:"Dana dikembalikan"};
const next:Record<Status,Status[]>={requested:["confirmed","cancelled"],confirmed:["paid","cancelled"],paid:["production","refunded"],production:["shipped","refunded"],shipped:["completed","refunded"],completed:["refunded"],cancelled:[],refunded:[]};
const panel="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]";
const field="w-full min-w-0 rounded-xl bg-[var(--bg)] px-3 py-2 ring-1 ring-[var(--border)]";
const btn="rounded-full bg-olive px-5 py-3 font-bold text-white disabled:opacity-50";
const hint="text-sm text-[var(--dim)]";
function minDate(){const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+21);return d.toISOString().slice(0,10);}
function EventSummary({event:e}:{event:EventRow}){
 return <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg font-extrabold">{e.eventName}</h3><span className="rounded-full bg-[#EEF4E4] px-3 py-1 text-xs font-bold text-olive-deep">{labels[e.status]}</span></div><p className={hint}>{e.code} · {e.eventDate} · {e.childAge} tahun · {e.guestCount} tamu</p><p className={hint}>Tema: {e.theme} · Target finalisasi desain: {e.deadline}</p><ul className="text-sm">{e.items.map(p=><li key={p.productId}>{PRODUCT_META[p.productId].title} × {e.guestCount} · {formatIDR(p.unitPrice)} / tamu</li>)}</ul><p className="font-bold">Total produk: {formatIDR(e.total)}</p>{e.trackingNumber&&<p className={hint}>Resi: {e.trackingNumber}</p>}</div>;
}
export function BirthdayPage(){
 const qc=useQueryClient();const catalog=useQuery({queryKey:["birthdayCatalog"],queryFn:()=>api.getBirthdayCatalog({})});
 const mine=useQuery({queryKey:["myBirthdayEvents"],queryFn:()=>api.listMyBirthdayEvents({})});
 const [selected,setSelected]=useState<Product["productId"][]>(["poster"]);const [guests,setGuests]=useState(20);
 const [eventName,setEventName]=useState("");const [age,setAge]=useState(4);const [date,setDate]=useState("");const [theme,setTheme]=useState("");
 const [organizer,setOrganizer]=useState("");const [wa,setWa]=useState("");const [address,setAddress]=useState("");const [notes,setNotes]=useState("");
 const [placed,setPlaced]=useState<EventRow|null>(null);const requestId=useRef<string|null>(null);
 const prices=catalog.data?.products??[];const perGuest=prices.filter(p=>selected.includes(p.productId)).reduce((n,p)=>n+p.unitPrice,0);
 const submit=useMutation({mutationFn:()=>api.createBirthdayEvent({requestId:requestId.current??=crypto.randomUUID(),eventName,childAge:age,eventDate:date,theme,guestCount:guests,productIds:selected,expectedPerGuest:perGuest,organizer,whatsapp:wa,address,notes}),onSuccess:r=>{setPlaced(r.event);requestId.current=null;void qc.invalidateQueries({queryKey:["myBirthdayEvents"]});}});
 return <div className="mx-auto max-w-5xl space-y-5 px-4 pb-24"><header className="band-sage rounded-[2rem] p-6 sm:p-9"><p className="text-xs font-bold uppercase tracking-widest">Bun & Fleur Kids · Ulang Tahun</p><h1 className="mt-2 font-display text-4xl font-extrabold">Hadiah kecil, kenangan besar.</h1><p className="mt-3 max-w-xl">Rencanakan hampers personalisasi untuk setiap tamu. Pilih produk dan tema, lalu tim kami membantu finalisasi desain dan pengiriman sekaligus ke alamat penyelenggara.</p></header>
 {placed?<section className={panel} role="status"><h2 className="font-display text-xl font-bold">Permintaan berhasil dikirim!</h2><EventSummary event={placed}/><p className={hint}>Simpan kode acara. Tim akan menghubungimu untuk konfirmasi desain, pembayaran, dan pengiriman. Belum perlu membayar sekarang.</p><button className={btn+" mt-3"} type="button" onClick={()=>setPlaced(null)}>Buat acara lain</button></section>:<form className="grid gap-4 lg:grid-cols-[1fr_340px]" onSubmit={e=>{e.preventDefault();if(selected.length&&perGuest>0&&!submit.isPending)submit.mutate();}}>
 <section className={panel+" grid gap-3"}><h2 className="font-display text-xl font-bold">Detail acara</h2>
 <label>Nama acara<input className={field} required maxLength={80} value={eventName} onChange={e=>setEventName(e.target.value)} placeholder="Ulang tahun Adam"/></label>
 <div className="grid grid-cols-2 gap-3"><label>Usia anak<input className={field} required type="number" min={1} max={18} value={age} onChange={e=>setAge(Number(e.target.value))}/></label><label>Tanggal acara<input className={field} required type="date" min={minDate()} value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 <label>Tema acara<input className={field} required maxLength={80} value={theme} onChange={e=>setTheme(e.target.value)} placeholder="Dinosaurus, hewan, luar angkasa..."/></label>
 <label>Jumlah tamu anak<input className={field} required type="number" min={20} max={500} value={guests} onChange={e=>setGuests(Number(e.target.value))}/></label>
 <h2 className="mt-2 font-display text-xl font-bold">Pilih isi hampers</h2><p className={hint}>Setiap tamu menerima satu unit dari setiap produk yang dipilih. Minimum 20 hampers, pemesanan minimal H-21. Target finalisasi desain H-10.</p>
 {catalog.isError&&<p role="alert">Harga belum tersedia. <button type="button" onClick={()=>void catalog.refetch()}>Muat ulang</button></p>}
 {prices.map(p=><label key={p.productId} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={selected.includes(p.productId)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.productId]:old.filter(x=>x!==p.productId))}/><span className="flex-1 font-bold">{PRODUCT_META[p.productId].title}</span><span>{formatIDR(p.unitPrice)}</span></label>)}
 <h2 className="mt-2 font-display text-xl font-bold">Kontak penyelenggara</h2><label>Nama orang tua / penyelenggara<input className={field} required maxLength={80} value={organizer} onChange={e=>setOrganizer(e.target.value)}/></label>
 <label>WhatsApp<input className={field} required type="tel" minLength={9} maxLength={20} value={wa} onChange={e=>setWa(e.target.value)}/></label>
 <label>Alamat pengiriman<textarea className={field} required minLength={10} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)}/></label>
 <label>Catatan desain, nama tamu, ukuran kaos (opsional)<textarea className={field} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)}/></label></section>
 <aside className={panel+" self-start space-y-3 lg:sticky lg:top-24"}><h2 className="font-display text-xl font-bold">Ringkasan hampers</h2><p>Harga per tamu: <strong>{formatIDR(perGuest)}</strong></p><p>Jumlah: {guests} tamu</p><p className="text-2xl font-extrabold text-olive-deep">{formatIDR(perGuest*Math.max(0,guests))}</p><p className={hint}>Total produk. Pengiriman dan detail desain dikonfirmasi tim. Untuk saat ini, pengumpulan desain tamu ditangani bersama penyelenggara, bukan melalui tautan khusus tamu.</p>
 {submit.isError&&<p role="alert" className="text-sm text-berry">{submit.error.message}</p>}<button className={btn+" w-full"} disabled={!perGuest||submit.isPending||!catalog.data}>{submit.isPending?"Mengirim…":"Ajukan Pemesanan"}</button></aside></form>}
 <section className={panel}><h2 className="font-display text-xl font-bold">Acara saya</h2><p className={hint}>Riwayat pada browser ini, tanpa login.</p>{mine.isPending&&<p>Memuat…</p>}{mine.isError&&<button type="button" onClick={()=>void mine.refetch()}>Coba lagi</button>}{mine.data?.events.length===0&&<p>Belum ada acara.</p>}{mine.data?.events.map(e=><article key={e.id} className="mt-3 border-t pt-3"><EventSummary event={e}/></article>)}</section></div>;
}
function ManageEvent({event:e}:{event:AdminRow}){
 const qc=useQueryClient();const [status,setStatus]=useState<Status>(e.status);const [ref,setRef]=useState("");const [amount,setAmount]=useState("");const [tracking,setTracking]=useState(e.trackingNumber);
 const update=useMutation({mutationFn:()=>api.adminUpdateBirthdayEvent({id:e.id,status,paymentReference:ref,paidAmount:amount===""?undefined:Number(amount),trackingNumber:tracking}),onSuccess:()=>{void qc.invalidateQueries({queryKey:["adminBirthdayEvents"]});void qc.invalidateQueries({queryKey:["myBirthdayEvents"]});}});
 return <article className={panel}><EventSummary event={e}/><p className="mt-3 text-sm">Penyelenggara: {e.organizer} · {e.whatsapp}</p><p className="text-sm">{e.address}</p><p className="whitespace-pre-wrap text-sm">{e.notes}</p>{e.paymentReference&&<p className={hint}>Referensi: {e.paymentReference}</p>}<form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={ev=>{ev.preventDefault();update.mutate();}}><label>Status<select className={field} value={status} onChange={ev=>setStatus(ev.target.value as Status)}>{[e.status,...next[e.status]].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>
 {status==="paid"&&e.status!=="paid"&&<><label>Nominal penuh diterima<input className={field} type="number" required value={amount} onChange={ev=>setAmount(ev.target.value)}/></label><label>Referensi mutasi<input className={field} required value={ref} onChange={ev=>setRef(ev.target.value)}/></label></>}
 {status==="shipped"&&<label>Nomor resi<input className={field} required value={tracking} onChange={ev=>setTracking(ev.target.value)}/></label>}
 <button className={btn} disabled={update.isPending||status===e.status}>Simpan status</button>{update.isError&&<p role="alert" className="text-berry">{update.error.message}</p>}</form></article>;
}
function PriceRow({p}:{p:Product}){
 const qc=useQueryClient();const [price,setPrice]=useState(String(p.unitPrice));
 const save=useMutation({mutationFn:()=>api.adminSetBirthdayPrice({productId:p.productId,price:Number(price)}),onSuccess:()=>void qc.invalidateQueries({queryKey:["birthdayCatalog"]})});
 return <form className="flex flex-wrap items-center gap-2 border-t py-2" onSubmit={e=>{e.preventDefault();save.mutate();}}><label className="flex-1">{PRODUCT_META[p.productId].title}<input className={field} type="number" required min={1000} max={10000000} value={price} onChange={e=>setPrice(e.target.value)}/></label><button className={btn} disabled={save.isPending}>Simpan</button>{save.isError&&<p role="alert">{save.error.message}</p>}{save.isSuccess&&<p>Tersimpan</p>}</form>;
}
export function BirthdayAdmin(){
 const [page,setPage]=useState(0);const list=useQuery({queryKey:["adminBirthdayEvents",page],queryFn:()=>api.adminListBirthdayEvents({offset:page*50})});const catalog=useQuery({queryKey:["birthdayCatalog"],queryFn:()=>api.getBirthdayCatalog({})});
 return <div className="space-y-4"><section className={panel}><h2 className="font-display text-2xl font-extrabold">Hampers Ulang Tahun</h2><p className={hint}>Pesanan acara dipisahkan dari retail; verifikasi nominal penuh setelah mutasi diterima.</p><p className="mt-3 font-bold">Jumlah acara: {list.data?.totalRequests??"—"} · Pendapatan acara lunas: {list.data?formatIDR(list.data.paidRevenue):"—"}</p></section><details className={panel}><summary className="cursor-pointer font-bold">Pengaturan harga hampers per tamu</summary>{catalog.data?.products.map(p=><PriceRow key={p.productId+":"+p.unitPrice} p={p}/>)}{catalog.isError&&<p>Harga gagal dimuat.</p>}</details>
 {list.isError&&<p role="alert">Daftar gagal dimuat. <button type="button" onClick={()=>void list.refetch()}>Muat ulang</button></p>}{list.isPending&&<p>Memuat…</p>}{list.data?.events.length===0&&<p>Belum ada acara.</p>}{list.data?.events.map(e=><ManageEvent key={e.id+":"+e.status} event={e}/>)}<div className="flex gap-3"><button className={btn} disabled={!page} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><button className={btn} disabled={!list.data||list.data.events.length<50} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></div></div>;
}
