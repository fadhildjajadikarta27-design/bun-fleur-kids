import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { logoUrl } from "../assets-inline";
import { saveAffiliateSession } from "./Affiliate";

const fieldClass =
  "mt-1.5 w-full rounded-2xl bg-[var(--bg)] px-4 py-3 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky";

const phoneValid = (raw: string) =>
  /^[+0-9() .-]+$/.test(raw) && raw.replace(/\D/g, "").length >= 9 && raw.replace(/\D/g, "").length <= 15;

const weakPin = (pin: string) =>
  /^(\d)\1{3}$/.test(pin) ||
  ["0123", "1234", "2345", "3456", "4567", "5678", "6789", "9876", "8765", "7654", "6543", "5432", "4321", "3210"].includes(pin);

export function AffiliateRegistrationPage() {
  const [form, setForm] = useState({ fullName: "", email: "", whatsapp: "", instagram: "", tiktok: "", couponCode: "" });
  const [step, setStep] = useState<"identity" | "pin">("identity");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const update = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));
  const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  const submit = useMutation({
    mutationFn: async () => api.affiliateApply({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      whatsapp: form.whatsapp.trim(),
      instagram: form.instagram.trim(),
      tiktok: form.tiktok.trim(),
      couponCode: form.couponCode.trim().toUpperCase(),
      pin,
      consent: true,
      website,
    }),
    onError: (err) => setError(err instanceof Error ? err.message : "Pendaftaran gagal. Coba lagi."),
    onSuccess: (res) => {
      saveAffiliateSession(res.sessionToken);
      window.location.hash = "/affiliate/dashboard";
    },
  });
  const next = () => {
    setError("");
    if (form.fullName.trim().length < 2) return setError("Nama lengkap minimal 2 karakter.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Format email tidak valid.");
    if (!phoneValid(form.whatsapp)) return setError("Nomor HP harus 9–15 digit angka, misalnya 081234567890.");
    if (form.couponCode.trim() && !/^[A-Za-z0-9_-]{3,24}$/.test(form.couponCode.trim())) {
      return setError("Kode kupon pilihan harus 3–24 karakter: huruf, angka, - atau _.");
    }
    setStep("pin");
  };
  const register = () => {
    setError("");
    if (!/^\d{4}$/.test(pin)) return setError("PIN harus tepat 4 digit angka.");
    if (weakPin(pin)) return setError("PIN terlalu mudah ditebak. Jangan pakai 0000 atau angka berurutan.");
    if (pin !== confirm) return setError("Konfirmasi PIN belum sama.");
    if (!consent) return setError("Setujui ketentuan program affiliate untuk melanjutkan.");
    submit.mutate();
  };
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <section className="band-sage mt-4 rounded-[2rem] px-6 py-8 text-center">
        <img src={logoUrl} alt="Bun & Fleur Kids" className="mx-auto h-20 w-20 rounded-3xl object-cover ring-1 ring-black/10" />
        <p className="band-accent mt-3 font-display text-xs font-bold uppercase tracking-[0.2em]">KOL &amp; Affiliate Partnership</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Gabung Jadi Affiliate</h1>
        <p className="band-dim mx-auto mt-3 max-w-lg font-semibold leading-relaxed">
          Daftar pakai nomor HP, buat PIN pribadi, dan langsung masuk dasbor affiliate.
          Tanpa OTP dan tanpa menunggu persetujuan WhatsApp.
        </p>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Tahapan pendaftaran">
        <div className={`rounded-2xl px-4 py-3 text-center font-display text-sm font-bold ${step === "identity" ? "bg-olive text-white" : "bg-[var(--surface-alt)] text-olive-deep"}`}>
          1. Data Diri
        </div>
        <div className={`rounded-2xl px-4 py-3 text-center font-display text-sm font-bold ${step === "pin" ? "bg-olive text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>
          2. Atur PIN
        </div>
      </div>

      {step === "identity" ? (
        <form className="mt-4 space-y-4 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-7"
          onSubmit={(e) => { e.preventDefault(); next(); }}>
          <h2 className="font-display text-xl font-extrabold">Data pendaftaran</h2>
          <div>
            <label htmlFor="aff-reg-name" className="font-display text-sm font-bold">Nama lengkap *</label>
            <input id="aff-reg-name" autoComplete="name" required maxLength={80}
              value={form.fullName} onChange={update("fullName")} placeholder="Nama lengkap" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="aff-reg-wa" className="font-display text-sm font-bold">Nomor HP / WhatsApp *</label>
            <input id="aff-reg-wa" type="tel" autoComplete="tel" inputMode="tel" required maxLength={24}
              value={form.whatsapp} onChange={update("whatsapp")} placeholder="081234567890" className={fieldClass} />
            <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Nomor ini yang digunakan untuk login berikutnya. Tidak ada kode OTP.</p>
          </div>
          <div>
            <label htmlFor="aff-reg-email" className="font-display text-sm font-bold">Email aktif *</label>
            <input id="aff-reg-email" type="email" autoComplete="email" maxLength={120} required
              value={form.email} onChange={update("email")} placeholder="nama@email.com" className={fieldClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="aff-reg-ig" className="font-display text-sm font-bold">Instagram (opsional)</label>
              <input id="aff-reg-ig" maxLength={80} value={form.instagram} onChange={update("instagram")}
                placeholder="@username" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="aff-reg-tt" className="font-display text-sm font-bold">TikTok (opsional)</label>
              <input id="aff-reg-tt" maxLength={80} value={form.tiktok} onChange={update("tiktok")}
                placeholder="@username" className={fieldClass} />
            </div>
          </div>
          <div>
            <label htmlFor="aff-reg-coupon" className="font-display text-sm font-bold">Kode kupon pilihan (opsional)</label>
            <input id="aff-reg-coupon" value={form.couponCode} maxLength={24} autoCapitalize="characters"
              onChange={update("couponCode")} placeholder="Contoh: BUNFADHIL" className={fieldClass} />
            <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
              Boleh pilih kode sendiri (3–24 karakter, huruf/angka/-/_). Harus unik.
              Jika kosong, kode otomatis dibuatkan.
            </p>
          </div>
          {error && <p role="alert" className="text-sm font-bold text-berry">{error}</p>}
          <button type="submit" className="w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-bold text-ink">
            Lanjut Buat PIN
          </button>
          <p className="text-center text-sm font-semibold text-[var(--dim)]">
            Sudah terdaftar? <a className="font-bold text-sky-deep underline" href="#/affiliate/login">Login di sini</a>
          </p>
        </form>
      ) : (
        <form className="mt-4 space-y-4 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-7"
          onSubmit={(e) => { e.preventDefault(); register(); }}>
          <h2 className="font-display text-xl font-extrabold">Atur PIN akunmu</h2>
          <div className="rounded-2xl bg-[var(--surface-alt)] p-4">
            <p className="font-display font-bold">{form.fullName.trim()}</p>
            <p className="text-sm font-semibold text-[var(--dim)]">Nomor login: {form.whatsapp.trim()}</p>
            <p className="text-sm font-semibold text-[var(--dim)]">Kode kupon: {form.couponCode.trim().toUpperCase() || "Dibuat otomatis"}</p>
          </div>
          <div>
            <label htmlFor="aff-register-pin" className="font-display text-sm font-bold">PIN 4 digit *</label>
            <input id="aff-register-pin" type="password" inputMode="numeric" autoComplete="new-password"
              maxLength={4} value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))}
              placeholder="••••" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="aff-register-pin-again" className="font-display text-sm font-bold">Ulangi PIN *</label>
            <input id="aff-register-pin-again" type="password" inputMode="numeric" autoComplete="new-password"
              maxLength={4} value={confirm} onChange={(e) => setConfirm(onlyDigits(e.target.value))}
              placeholder="••••" className={fieldClass} />
          </div>
          <p className="text-xs font-semibold text-[var(--dim)]">
            PIN tidak bisa dilihat admin dan disimpan sebagai hash. Hindari angka berulang atau berurutan.
            Lima kali salah PIN akan mengunci akun sementara.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--bg)] px-4 py-3 text-sm font-semibold">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-olive" checked={consent}
              onChange={(event) => setConsent(event.target.checked)} />
            <span>Saya menyetujui syarat program affiliate dan penggunaan data kontak untuk administrasi kemitraan.</span>
          </label>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="aff-reg-web">Website</label>
            <input id="aff-reg-web" tabIndex={-1} autoComplete="off" value={website}
              onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm font-bold text-berry">{error}</p>}
          <button type="submit" disabled={submit.isPending}
            className="w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-bold text-ink disabled:cursor-wait disabled:opacity-50">
            {submit.isPending ? "Membuat akun…" : "Buat Akun & Masuk Dasbor"}
          </button>
          <button type="button" onClick={() => { setError(""); setStep("identity"); }}
            className="w-full rounded-full bg-[var(--surface-alt)] px-5 py-3 font-display text-sm font-bold ring-1 ring-[var(--border)]">
            Kembali ke Data Diri
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm font-semibold text-[var(--dim)]">
        Komisi awal 30% dari subtotal produk setelah diskon. Minimum pencairan Rp50.000.
      </p>
    </div>
  );
}
