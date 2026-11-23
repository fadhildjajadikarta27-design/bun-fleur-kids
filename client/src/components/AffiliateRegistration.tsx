import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { logoUrl } from "../assets-inline";

const fieldClass =
  "mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-3 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky";

export function AffiliateRegistrationPage() {
  const [form, setForm] = useState({
    fullName: "", email: "", whatsapp: "", instagram: "", tiktok: "",
  });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = useMutation({
    mutationFn: async () => api.affiliateApply({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      whatsapp: form.whatsapp.trim(),
      instagram: form.instagram.trim(),
      tiktok: form.tiktok.trim(),
      consent: true,
      website,
    }),
    onSuccess: () => { setDone(true); setError(""); },
    onError: (err) => setError(err instanceof Error ? err.message : "Pendaftaran tidak berhasil. Coba lagi."),
  });
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <section className="band-sage mt-4 rounded-[2rem] px-6 py-8 text-center">
        <img src={logoUrl} alt="Bun & Fleur Kids" className="mx-auto h-20 w-20 rounded-3xl object-cover ring-1 ring-black/10" />
        <p className="band-accent mt-3 font-display text-xs font-bold uppercase tracking-[0.2em]">KOL &amp; Affiliate Partnership</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Jadi Partner Bun &amp; Fleur Kids</h1>
        <p className="band-dim mt-3 leading-relaxed">
          Daftar lewat satu link ini. Tim kami akan menghubungi nomor WhatsApp yang kamu isi
          untuk konfirmasi sebelum akun affiliate disetujui.
        </p>
      </section>

      {done ? (
        <section className="mt-5 rounded-3xl bg-[var(--surface)] p-6 text-center ring-1 ring-[var(--border)]" role="status">
          <h2 className="font-display text-2xl font-extrabold text-olive-deep">Pendaftaran diterima!</h2>
          <p className="mt-3 font-semibold leading-relaxed text-[var(--dim)]">
            Terima kasih, {form.fullName.trim()}. Tim Bun &amp; Fleur Kids akan menghubungi WhatsApp
            <strong className="text-ink"> {form.whatsapp} </strong>untuk konfirmasi.
            Pastikan nomornya aktif dan bisa menerima chat.
          </p>
          <p className="mt-3 text-sm font-semibold text-[var(--dim)]">
            Akun dan kode affiliate belum aktif sampai tim menyetujui pendaftaran.
            Jika disetujui, tautan aktivasi pribadi akan dikirimkan lewat WhatsApp.
          </p>
          <a href="/" className="mt-5 inline-flex rounded-full bg-olive px-6 py-3 font-display font-bold text-white">Kembali ke Beranda</a>
        </section>
      ) : (
        <form className="mt-5 space-y-4 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-7"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            if (form.fullName.trim().length < 2) return setError("Isi nama lengkap terlebih dahulu.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Format email belum benar.");
            const wa = form.whatsapp.trim();
            if (!/^[+0-9() .-]+$/.test(wa) || wa.replace(/\D/g, "").length < 9 || wa.replace(/\D/g, "").length > 15) {
              return setError("Nomor WhatsApp harus 9–15 digit angka, misalnya 081234567890.");
            }
            if (!consent) return setError("Setujui konfirmasi melalui WhatsApp untuk melanjutkan.");
            submit.mutate();
          }}>
          <div>
            <label htmlFor="aff-reg-name" className="font-display text-sm font-bold">Nama lengkap *</label>
            <input id="aff-reg-name" autoComplete="name" required maxLength={80}
              value={form.fullName} onChange={set("fullName")} placeholder="Nama lengkap kamu" className={fieldClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="aff-reg-email" className="font-display text-sm font-bold">Email aktif *</label>
              <input id="aff-reg-email" type="email" autoComplete="email" maxLength={120} required
                value={form.email} onChange={set("email")} placeholder="nama@email.com" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="aff-reg-wa" className="font-display text-sm font-bold">Nomor WhatsApp aktif *</label>
              <input id="aff-reg-wa" type="tel" autoComplete="tel" inputMode="tel" required maxLength={24}
                value={form.whatsapp} onChange={set("whatsapp")} placeholder="081234567890" className={fieldClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="aff-reg-ig" className="font-display text-sm font-bold">Instagram (opsional)</label>
              <input id="aff-reg-ig" maxLength={80} value={form.instagram} onChange={set("instagram")}
                placeholder="@username" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="aff-reg-tt" className="font-display text-sm font-bold">TikTok (opsional)</label>
              <input id="aff-reg-tt" maxLength={80} value={form.tiktok} onChange={set("tiktok")}
                placeholder="@username" className={fieldClass} />
            </div>
          </div>
          <div aria-hidden="true" className="hidden">
            <label htmlFor="aff-reg-website">Website</label>
            <input id="aff-reg-website" tabIndex={-1} autoComplete="off"
              value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--bg)] px-4 py-3 text-sm font-semibold">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-olive" checked={consent}
              onChange={(event) => setConsent(event.target.checked)} />
            <span>Saya bersedia dihubungi Bun &amp; Fleur Kids melalui nomor WhatsApp di atas untuk verifikasi dan informasi kemitraan.</span>
          </label>
          {error && <p className="font-semibold text-berry" role="alert">{error}</p>}
          <button type="submit" disabled={submit.isPending}
            className="w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-bold text-white disabled:cursor-wait disabled:opacity-50">
            {submit.isPending ? "Mengirim pendaftaran…" : "Daftar Jadi Affiliate"}
          </button>
          <p className="text-center text-xs font-semibold text-[var(--dim)]">
            Komisi awal 30% dari subtotal produk bersih setelah diskon pelanggan.
            Pendaftaran tidak otomatis mengaktifkan akun.
          </p>
        </form>
      )}
    </div>
  );
}
