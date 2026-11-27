import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "../api";
import { ACTIVE_PRODUCT_IDS, PRODUCT_META, formatIDR, type ProductId } from "../lib/shop";
import { AdminOrders, AdminProductPrices } from "./Shop";
import { AffiliateAdmin } from "./Affiliate";
import { BirthdayAdmin } from "./Birthday";
import { BundleAdmin } from "./BundleAdmin";

const tabs = [
  { id: "overview", label: "Ringkasan" },
  { id: "orders", label: "Pesanan & Penjualan" },
  { id: "payment", label: "Pembayaran QRIS" },
  { id: "fulfillment", label: "Produksi & Pengiriman" },
  { id: "products", label: "Produk & Harga" },
  { id: "birthday", label: "Hampers Ulang Tahun" },
  { id: "bundles", label: "Paket Hemat & Promo" },
  { id: "affiliate", label: "Affiliate & Kupon" },
  { id: "finance", label: "Laporan Keuangan" },
  { id: "settings", label: "Pengaturan" },
] as const;
type Tab = typeof tabs[number]["id"];
const panel = "rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] sm:p-6";
const field = "min-w-0 rounded-xl bg-[var(--bg)] px-3 py-2 ring-1 ring-[var(--border)]";
const button = "rounded-full bg-olive px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const outline = "rounded-full border border-olive/30 px-4 py-2 text-sm font-bold text-olive-deep disabled:opacity-50";
const heading = "font-display text-2xl font-extrabold text-olive-deep";
const hint = "text-sm font-semibold text-[var(--dim)]";
type Report = ApiResponse<typeof api, "adminSalesReport">;
type Daily = Report["daily"][number];

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return parts.find(p => p.type === "year")?.value + "-" + parts.find(p => p.type === "month")?.value;
}
function monthLabel(month: string) {
  return new Date(month + "-01T00:00:00+07:00").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}
function sum(rows: Daily[]) {
  return rows.reduce((v, row) => ({ orders: v.orders + row.orders, quantity: v.quantity + row.quantity, gross: v.gross + row.gross,
    discount: v.discount + row.discount, commission: v.commission + row.commission,
    net: v.net + row.gross - row.discount }), { orders: 0, quantity: 0, gross: 0, discount: 0, commission: 0, net: 0 });
}
function metrics(items: { label: string; value: string | number }[]) {
  return <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(item => <div key={item.label} className="min-w-0 rounded-2xl bg-[#EEF2E5] p-3 sm:p-4">
    <dt className="text-xs font-bold text-olive-deep">{item.label}</dt>
    <dd className="mt-2 break-words font-display text-lg font-extrabold text-olive-deep sm:text-2xl">{item.value}</dd>
  </div>)}</dl>;
}
function Overview({ open }: { open: (tab: Tab) => void }) {
  const orders = useQuery({ queryKey: ["orders", "summary"], queryFn: () => api.listOrders({ limit: 1 }), refetchOnWindowFocus: true });
  const affiliate = useQuery({ queryKey: ["adminAffiliates"], queryFn: () => api.adminListAffiliates({}), refetchOnWindowFocus: true });
  const number = (v: number | undefined) => v === undefined ? "—" : v;
  return <section className={panel}>
    <h2 className={heading}>Ringkasan bisnis</h2><p className={hint + " mb-4"}>Seluruh pesanan tercatat; pendapatan produk neto hanya dari pesanan lunas dan tidak termasuk ongkir atau kode unik.</p>
    {metrics([
      { label: "Pendapatan produk neto", value: orders.data ? formatIDR(orders.data.netProductRevenue) : "—" },
      { label: "Total pesanan", value: number(orders.data?.orderCount) },
      { label: "Pesanan lunas", value: number(orders.data?.paidCount) },
      { label: "Menunggu verifikasi", value: number(orders.data?.paymentReviewCount) },
      { label: "Affiliate terdaftar", value: number(affiliate.data?.affiliates.length) },
      { label: "Affiliate aktif", value: affiliate.data ? affiliate.data.affiliates.filter(a => a.status === "active").length : "—" },
    ])}
    {(orders.isError || affiliate.isError) && <p role="alert" className="mt-3 text-sm font-bold text-berry">Sebagian ringkasan tidak tersedia. Coba muat ulang.</p>}
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="button" className={button} onClick={() => open("orders")}>Buka pesanan</button>
      <button type="button" className={outline} onClick={() => open("payment")}>Verifikasi pembayaran</button>
      <button type="button" className={outline} onClick={() => open("affiliate")}>Kelola affiliate</button>
      <button type="button" className={outline} onClick={() => open("finance")}>Laporan penjualan</button>
      <button type="button" className={outline} onClick={() => { void orders.refetch(); void affiliate.refetch(); }}>Muat ulang ringkasan</button>
    </div>
  </section>;
}
function CostForm({ report, month }: { report: Report; month: string }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState<ProductId>("poster");
  const [costInput, setCostInput] = useState<string | null>(null);
  const [expenseInput, setExpenseInput] = useState<string | null>(null);
  const existing = report.costs.find(c => c.productId === productId)?.unitCost;
  const cost = costInput ?? (existing === undefined ? "" : String(existing));
  const expense = expenseInput ?? (report.operatingCost === null ? "" : String(report.operatingCost));
  const saveCost = useMutation({
    mutationFn: (unitCost: number | null) => api.adminSetProductCost({ productId, unitCost }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["adminSalesReport"] }); setCostInput(null); },
  });
  const saveExpense = useMutation({
    mutationFn: (amount: number | null) => api.adminSetOperatingCost({ month, amount }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["adminSalesReport"] }); setExpenseInput(null); },
  });
  const ids = Array.from(new Set<ProductId>([...ACTIVE_PRODUCT_IDS, ...report.daily.map(r => r.productId), ...report.costs.map(c => c.productId)]));
  return <section className={panel + " mt-4"}>
    <h3 className="font-display text-lg font-extrabold">HPP & biaya operasional</h3>
    <p className={hint + " mt-1"}>HPP per unit saat ini digunakan sebagai estimasi untuk periode yang dipilih, bukan biaya historis yang sudah dicatat per transaksi. Biaya operasional adalah total bulanan yang kamu masukkan sendiri.</p>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <form className="grid gap-2 rounded-2xl bg-[var(--bg)] p-3" onSubmit={e => { e.preventDefault(); if (cost !== "") saveCost.mutate(Number(cost)); }}>
        <label className="grid gap-1 text-sm font-bold">Produk
          <select className={field} value={productId} onChange={e => { setProductId(e.target.value as ProductId); setCostInput(null); saveCost.reset(); }}>
            {ids.map(id => <option key={id} value={id}>{PRODUCT_META[id].title}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">Estimasi HPP per unit (Rp)
          <input type="number" className={field} required min={0} max={10000000} step={1} value={cost} onChange={e => setCostInput(e.target.value)} placeholder="Belum diatur" />
        </label>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={saveCost.isPending}>Simpan HPP</button><button type="button" className={outline} disabled={saveCost.isPending} onClick={() => saveCost.mutate(null)}>Kosongkan</button></div>
        {saveCost.isError && <p role="alert" className="text-sm text-berry">{saveCost.error.message}</p>}
        {saveCost.isSuccess && <p role="status" className={hint}>HPP tersimpan.</p>}
      </form>
      <form className="grid content-start gap-2 rounded-2xl bg-[var(--bg)] p-3" onSubmit={e => { e.preventDefault(); if (expense !== "") saveExpense.mutate(Number(expense)); }}>
        <label className="grid gap-1 text-sm font-bold">Total biaya operasional — {monthLabel(month)} (Rp)
          <input className={field} type="number" required min={0} max={2000000000} step={1} value={expense} onChange={e => setExpenseInput(e.target.value)} placeholder="Belum dicatat" />
        </label>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={saveExpense.isPending}>Simpan biaya</button><button type="button" className={outline} disabled={saveExpense.isPending} onClick={() => saveExpense.mutate(null)}>Kosongkan</button></div>
        {saveExpense.isError && <p role="alert" className="text-sm text-berry">{saveExpense.error.message}</p>}
        {saveExpense.isSuccess && <p role="status" className={hint}>Biaya tersimpan.</p>}
      </form>
    </div>
  </section>;
}
function Finance() {
  const [month, setMonth] = useState(currentMonth);
  const [grain, setGrain] = useState<"day" | "month">("day");
  const report = useQuery({ queryKey: ["adminSalesReport", month], queryFn: () => api.adminSalesReport({ month }), enabled: /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) });
  if (!report.data) return <section className={panel}><h2 className={heading}>Laporan keuangan</h2><label className="mt-3 block text-sm font-bold">Bulan <input type="month" className={field} value={month} onChange={e => setMonth(e.target.value)} /></label>{report.isError ? <div role="alert" className="mt-3"><p>{report.error.message}</p><button type="button" className={outline} onClick={() => void report.refetch()}>Coba lagi</button></div> : <p className={hint + " mt-3"}>Pilih bulan yang valid untuk memuat laporan.</p>}</section>;
  const data = report.data;
  const selected = data.daily.filter(r => r.day.startsWith(month + "-"));
  const total = sum(selected);
  const direct = sum(selected.filter(r => !r.affiliate));
  const via = sum(selected.filter(r => r.affiliate));
  const costs = new Map(data.costs.map(c => [c.productId, c.unitCost]));
  const missing = Array.from(new Set(selected.filter(r => !costs.has(r.productId)).map(r => r.productId)));
  const hpp = missing.length ? null : selected.reduce((n, r) => n + r.quantity * (costs.get(r.productId) ?? 0), 0);
  const grossProfit = hpp === null ? null : total.net - hpp;
  const netProfit = grossProfit === null || data.operatingCost === null ? null : grossProfit - total.commission - data.operatingCost;
  const [year, m] = month.split("-").map(Number) as [number, number];
  const dayCount = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const periods = grain === "day" ? Array.from({ length: dayCount }, (_, i) => month + "-" + String(i + 1).padStart(2, "0"))
    : Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(year, m - 12 + i, 1)).toISOString().slice(0, 7));
  const trend = periods.map(period => ({ period, ...sum(data.daily.filter(r => r.day.startsWith(period))) }));
  const max = Math.max(1, ...trend.map(r => r.net));
  const ranking = [...new Set(selected.map(r => r.productId))].map(id => ({ id, ...sum(selected.filter(r => r.productId === id)) })).sort((a, b) => b.quantity - a.quantity || b.net - a.net);
  function exportCsv() {
    const rows = [["Periode WIB","Produk","Kanal","Pesanan","Unit","Penjualan kotor","Diskon","Penjualan neto","Komisi tercatat","Estimasi HPP"],
      ...selected.map(r => [r.day,PRODUCT_META[r.productId].title,r.affiliate ? "Affiliate" : "Langsung",r.orders,r.quantity,r.gross,r.discount,r.gross-r.discount,r.commission,costs.has(r.productId) ? r.quantity * costs.get(r.productId)! : "Belum diatur"]),
      [], ["Ringkasan",month],["Penjualan neto",total.net],["Komisi tercatat",total.commission],["Estimasi HPP",hpp ?? "Belum lengkap"],["Estimasi laba kotor",grossProfit ?? "Belum lengkap"],["Biaya operasional",data.operatingCost ?? "Belum dicatat"],["Estimasi laba setelah komisi dan biaya",netProfit ?? "Belum lengkap"]];
    const csv = rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "bun-fleur-penjualan-" + month + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div>
    <section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className={heading}>Laporan keuangan</h2><p className={hint}>Periode berdasarkan tanggal pesanan WIB; hanya pesanan yang saat ini berstatus lunas. Refund tidak dihitung sebagai penjualan lunas.</p></div>
        <label className="grid gap-1 text-sm font-bold">Bulan<input type="month" min="2020-01" max="2099-12" value={month} onChange={e => { if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} className={field} /></label>
        <button type="button" className={outline} onClick={exportCsv}>Unduh CSV (Excel)</button>
        <button type="button" className={outline} disabled={report.isFetching} onClick={() => void report.refetch()}>Muat ulang</button>
      </div>
      <h3 className="my-4 font-display text-lg font-extrabold">{monthLabel(month)}</h3>
      {metrics([
        { label:"Penjualan kotor", value:formatIDR(total.gross) },{ label:"Diskon pelanggan", value:formatIDR(total.discount) },
        { label:"Penjualan neto", value:formatIDR(total.net) },{ label:"Pesanan lunas", value:total.orders },
        { label:"Unit terjual", value:total.quantity },{ label:"Penjualan langsung", value:formatIDR(direct.net) },
        { label:"Penjualan affiliate", value:formatIDR(via.net) },{ label:"Komisi affiliate tercatat", value:formatIDR(total.commission) },
        { label:"Estimasi HPP", value:hpp === null ? "Belum lengkap" : formatIDR(hpp) },
        { label:"Estimasi laba kotor", value:grossProfit === null ? "Belum lengkap" : formatIDR(grossProfit) },
        { label:"Biaya operasional", value:data.operatingCost === null ? "Belum dicatat" : formatIDR(data.operatingCost) },
        { label:"Estimasi laba setelah biaya", value:netProfit === null ? "Belum lengkap" : formatIDR(netProfit) },
      ])}
      <p className={hint + " mt-3"}>Estimasi belum termasuk pajak, ongkir aktual, biaya pembayaran, atau biaya lain yang belum dicatat. {missing.length > 0 && "HPP belum diatur: " + missing.map(id => PRODUCT_META[id].title).join(", ") + "."}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold">Tren penjualan neto</h3><div className="flex gap-2">
          <button type="button" aria-pressed={grain === "day"} className={grain === "day" ? button : outline} onClick={() => setGrain("day")}>Harian</button>
          <button type="button" aria-pressed={grain === "month"} className={grain === "month" ? button : outline} onClick={() => setGrain("month")}>12 bulan</button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto"><div role="img" aria-label="Grafik penjualan neto; angka rinci tersedia di bawah" className="flex h-40 min-w-[480px] items-end gap-1 border-b border-[var(--border)]">
        {trend.map(r => <div key={r.period} title={r.period + ": " + formatIDR(r.net)} className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t bg-olive" style={{height: (r.net > 0 ? Math.max(2, r.net/max*100) : 0) + "%"}} /><span className="text-center text-[9px] text-[var(--dim)]">{r.period.slice(-2)}</span></div>)}
      </div></div>
      <details className="mt-3"><summary className="cursor-pointer text-sm font-bold">Angka tren lengkap</summary><div className="mt-2 grid gap-1 text-sm">{trend.map(r => <div key={r.period} className="flex justify-between border-b border-[var(--border)] py-1"><span>{r.period}</span><span>{formatIDR(r.net)}</span></div>)}</div></details>
      <h3 className="mt-6 font-display text-lg font-extrabold">Produk terlaris berdasarkan unit</h3>
      {ranking.length === 0 ? <p className={hint}>Belum ada penjualan lunas pada periode ini.</p> : <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr><th className="py-2">Produk</th><th>Unit</th><th>Penjualan neto</th></tr></thead><tbody>{ranking.map(r => <tr key={r.id} className="border-t border-[var(--border)]"><td className="py-2">{PRODUCT_META[r.id].title}</td><td>{r.quantity}</td><td>{formatIDR(r.net)}</td></tr>)}</tbody></table></div>}
    </section>
    <CostForm key={month} report={data} month={month} />
  </div>;
}
function Settings({ brandName }: { brandName: string }) {
  const qc = useQueryClient();
  const [brand, setBrand] = useState(brandName);
  const save = useMutation({ mutationFn: () => api.updateSettings({ brandName: brand.trim() }), onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }) });
  return <section className={panel}><h2 className={heading}>Pengaturan</h2>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <label className="grid flex-1 gap-1 text-sm font-bold">Nama studio<input required maxLength={40} className={field} value={brand} onChange={e => {setBrand(e.target.value);save.reset();}} /></label>
      <button className={button} disabled={!brand.trim() || save.isPending}>Simpan nama</button>
    </form>
    {save.isError && <p role="alert" className="mt-2 text-sm text-berry">{save.error.message}</p>}
    {save.isSuccess && <p role="status" className={hint}>Nama studio tersimpan.</p>}
    <p className={hint + " mt-4"}>Pengaturan komisi, minimum pencairan, diskon, undangan dan audit aktivitas tersedia di tab Affiliate. Password admin dikelola melalui konfigurasi server, bukan ditampilkan di dashboard.</p>
  </section>;
}
function startingTab(): Tab {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash;
  return h === "#/admin/orders" ? "orders" : h === "#/admin/affiliate" || h === "#/kelola-afiliasi-4821" ? "affiliate" : "overview";
}
export function AdminCenter({ brandName }: { brandName: string }) {
  const [tab, setTab] = useState<Tab>(startingTab);
  return <div className="mx-auto max-w-7xl px-4 pb-16">
    <div className="band-sage mb-5 rounded-[2rem] px-5 py-6 sm:px-8">
      <p className="band-accent font-display text-xs font-bold uppercase tracking-widest">Khusus Admin</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Bun &amp; Fleur Kids — Admin Center</h1>
      <p className="band-dim mt-2 text-sm">Satu tempat untuk mengelola seluruh operasional bisnis.</p>
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Menu admin" className="flex flex-wrap content-start gap-2 lg:sticky lg:top-4 lg:self-start lg:flex-col">{tabs.map(item =>
        <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)} className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${tab === item.id ? "bg-olive text-white" : "bg-[var(--surface)] text-olive-deep ring-1 ring-[var(--border)]"}`}>{item.label}</button>)}
      </nav>
      <section aria-label={tabs.find(t => t.id === tab)?.label} className="min-w-0">
        {tab === "overview" && <Overview open={setTab} />}
        {(tab === "orders" || tab === "payment" || tab === "fulfillment") && <section className={panel}>
          <h2 className={heading}>{tabs.find(t => t.id === tab)?.label}</h2>
          <p className={hint + " mb-4"}>{tab === "payment" ? "Pesanan menunggu pencocokan QRIS; verifikasi hanya setelah mutasi diterima." : tab === "fulfillment" ? "Pesanan lunas yang masih perlu diproses atau dikirim. Unduh artwork pesanan dan catat resi." : "Seluruh riwayat pesanan, pembayaran, ongkir dan status pengiriman."}</p>
          <AdminOrders key={tab} scope={tab === "orders" ? "all" : tab} />
        </section>}
        {tab === "products" && <AdminProductPrices />}
        {tab === "birthday" && <BirthdayAdmin />}
        {tab === "bundles" && <BundleAdmin />}
        {tab === "affiliate" && <section className={panel}><h2 className={heading}>Manajemen affiliate</h2><AffiliateAdmin /></section>}
        {tab === "finance" && <Finance />}
        {tab === "settings" && <Settings brandName={brandName} />}
      </section>
    </div>
  </div>;
}
