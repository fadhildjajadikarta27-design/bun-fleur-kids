// Affiliate program UI (brief Part 3): invitation activation with a
// 4-digit PIN, returning login with lockout-aware errors, PIN reset,
// the private dashboard (stats, sales chart, order history, KPI,
// commission wallet, payout requests), and the admin management panel
// used inside the Parent Dashboard.
//
// Deep links are hash routes the app shell understands:
//   #/affiliate/invite/<token>   #/affiliate/reset/<token>
//   #/affiliate/login            #/affiliate/dashboard
//   #/ref/<coupon>               (referral attribution)
// The browser keeps credentials in an HttpOnly cookie. localStorage stores only a UI hint.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "../api";
import { FIELDS } from "../fields";
import { formatIDR, PRODUCT_META, type ProductId } from "../lib/shop";
import { logoUrl } from "../assets-inline";
const SESSION_KEY = "bfk-aff-session";

export function loadAffiliateSession(): string {
  try {
    const marker = localStorage.getItem(SESSION_KEY);
    if (marker === "cookie-session") return marker;
    if (marker) localStorage.removeItem(SESSION_KEY);
    return "";
  } catch {
    return "";
  }
}

export function saveAffiliateSession(token: string) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, "cookie-session");
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Session simply won't persist across reloads.
  }
}

export function inviteLink(token: string): string {
  return `#/affiliate/invite/${token}`;
}

export function resetLink(token: string): string {
  const route = `#/affiliate/reset/${token}`;
  return typeof window === "undefined" ? route : `${window.location.origin}/${route}`;
}

export function referralLink(couponCode: string): string {
  const route = `#/ref/${encodeURIComponent(couponCode)}`;
  return typeof window === "undefined" ? route : `${window.location.origin}/${route}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 2200);
        }
      }}
      className="rounded-full bg-olive px-4 py-2 font-display text-xs font-semibold text-white"
    >
      {done ? "Tersalin ✓" : label}
    </button>
  );
}

const inputCls =
  "mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-2.5 font-semibold ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky";
const pinCls =
  "mt-1 w-full rounded-2xl bg-[var(--bg)] px-4 py-3 text-center font-display text-2xl font-bold tracking-[0.6em] ring-1 ring-[var(--border)] focus:outline-2 focus:outline-sky";

function PinFields({
  pin,
  setPin,
  confirm,
  setConfirm,
  idPrefix,
}: {
  pin: string;
  setPin: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  idPrefix: string;
}) {
  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-pin`} className="font-display text-sm font-bold">Buat PIN 4 digit kamu</label>
        <input
          id={`${idPrefix}-pin`}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(digitsOnly(e.target.value))}
          placeholder="••••"
          className={pinCls}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-pin2`} className="font-display text-sm font-bold">Ketik ulang PIN-nya</label>
        <input
          id={`${idPrefix}-pin2`}
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          value={confirm}
          onChange={(e) => setConfirm(digitsOnly(e.target.value))}
          placeholder="••••"
          className={pinCls}
        />
        {confirm.length === 4 && pin !== confirm && (
          <p className="mt-1 text-sm font-bold text-berry" role="alert">PIN-nya belum sama — periksa lagi ketikanmu.</p>
        )}
      </div>
      <p className="text-xs font-semibold text-[var(--dim)]">
        PIN terlalu mudah seperti 0000, 1111, atau 1234 akan ditolak. PIN tersimpan terenkripsi di server — admin pun tidak bisa melihatnya.
      </p>
    </>
  );
}

function pinFormError(pin: string, confirm: string): string {
  if (!/^\d{4}$/.test(pin)) return "PIN harus tepat 4 digit angka.";
  if (pin !== confirm) return "PIN dan konfirmasinya belum sama.";
  return "";
}

/* ------------------------------ Invitation ------------------------------ */

export function AffiliateInvitePage({
  token,
  goDashboard,
  goLogin,
}: {
  token: string;
  goDashboard: () => void;
  goLogin: () => void;
}) {
  const invite = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.getInvitation({ token }),
    enabled: token.length >= 8,
  });
  const [step, setStep] = useState<"welcome" | "pin" | "done">("welcome");
  const [identity, setIdentity] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const accept = useMutation({
    mutationFn: async () => await api.acceptInvitation({ token, identity: identity.trim(), pin }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      saveAffiliateSession(res.sessionToken);
      setStep("done");
    },
  });
  const data = invite.data;
  return (
    <div className="mx-auto max-w-xl px-4 pb-16">
      <section className="band-sage mt-4 rounded-[2rem] px-6 py-8 text-center">
        <img src={logoUrl} alt="" className="mx-auto h-16 w-16 rounded-3xl object-cover ring-1 ring-black/10" />
        <h1 className="mt-3 font-display text-3xl font-semibold">Welcome to Bun &amp; Fleur Kids Affiliate!</h1>
        <p className="band-dim mt-1 font-semibold">Your creative partnership starts here.</p>
      </section>

      {invite.isPending && <p className="mt-6 text-center font-display font-bold">Memeriksa tautan undanganmu…</p>}
      {invite.error && (
        <p className="mt-6 rounded-3xl bg-[var(--surface)] p-5 text-center font-semibold ring-1 ring-[var(--border)]">
          Undangan tidak bisa diperiksa sekarang. Coba muat ulang sebentar lagi.
        </p>
      )}
      {data && !data.valid && (
        <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 text-center ring-1 ring-[var(--border)]" aria-label="Undangan tidak berlaku">
          <h2 className="font-display text-xl font-semibold">Tautan ini sudah tidak berlaku</h2>
          <p className="mt-1 font-semibold text-[var(--dim)]">
            {data.reason === "used" && "Undangan ini sudah pernah dipakai untuk aktivasi. Kalau itu kamu, langsung masuk saja ke dasbormu."}
            {data.reason === "expired" && "Masa berlaku undangan ini sudah habis (tautan undangan memang dibatasi waktunya demi keamanan). Minta tautan baru ke tim Bun & Fleur Kids."}
            {data.reason === "revoked" && "Undangan ini sudah dicabut oleh admin. Minta tautan baru ke tim Bun & Fleur Kids."}
            {data.reason === "not_found" && "Kami tidak menemukan undangan ini. Periksa lagi tautannya, atau minta tautan baru ke tim Bun & Fleur Kids."}
          </p>
          <button type="button" onClick={goLogin} className="mt-4 rounded-full bg-olive px-6 py-3 font-display text-base font-semibold text-white">
            Ke Halaman Masuk Afiliasi
          </button>
        </section>
      )}
      {data?.valid && step === "welcome" && (
        <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Konfirmasi identitas">
          <h2 className="font-display text-xl font-semibold">Halo, {data.affiliateName}!</h2>
          <p className="mt-1 font-semibold leading-relaxed text-[var(--dim)]">
            Undangan ini dibuat khusus untukmu. Konfirmasi dulu email atau nomor WhatsApp yang
            didaftarkan admin untukmu, lalu buat PIN dasbormu sendiri.
          </p>
          <div className="mt-4">
            <label htmlFor="invite-identity" className="font-display text-sm font-bold">Email atau nomor WhatsApp terdaftar</label>
            <input
              id="invite-identity"
              {...FIELDS.acceptInvitation.identity}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              autoComplete="email"
              placeholder="cth. maya@email.com atau 0812…"
              className={inputCls}
            />
          </div>
          {error && <p className="mt-3 text-sm font-bold text-berry" role="alert">{error}</p>}
          <button
            type="button"
            disabled={identity.trim().length < 3}
            onClick={() => {
              setError("");
              setStep("pin");
            }}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-ink disabled:opacity-50"
          >
            Create Your 4-Digit PIN
          </button>
          <p className="mt-2 text-center text-xs font-semibold text-[var(--dim)]">
            Tautan berlaku sampai {data.expiresAt ? new Date(data.expiresAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"} dan hanya bisa dipakai satu kali.
          </p>
        </section>
      )}
      {data?.valid && step === "pin" && (
        <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Buat PIN">
          <h2 className="font-display text-xl font-semibold">Satu langkah lagi, {data.affiliateName}</h2>
          <p className="mt-1 font-semibold text-[var(--dim)]">PIN ini yang kamu pakai untuk membuka dasbor afiliasimu di perangkat ini.</p>
          <div className="mt-4 space-y-3">
            <PinFields pin={pin} setPin={setPin} confirm={confirm} setConfirm={setConfirm} idPrefix="invite" />
          </div>
          {error && <p className="mt-3 text-sm font-bold text-berry" role="alert">{error}</p>}
          <button
            type="button"
            disabled={accept.isPending}
            onClick={() => {
              const err = pinFormError(pin, confirm);
              if (err) {
                setError(err);
                return;
              }
              setError("");
              accept.mutate();
            }}
            className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-ink disabled:opacity-50"
          >
            {accept.isPending ? "Mengaktifkan…" : "Aktifkan Akun Saya"}
          </button>
          <button type="button" onClick={() => setStep("welcome")} className="mt-2 w-full rounded-full bg-[var(--surface-alt)] px-6 py-2.5 font-display text-sm font-bold ring-1 ring-[var(--border)]">
            ← Periksa identitas lagi
          </button>
        </section>
      )}
      {step === "done" && (
        <section className="band-sage mt-5 rounded-3xl px-6 py-8 text-center" aria-label="Aktivasi selesai">
          <h2 className="font-display text-3xl font-semibold">You&rsquo;re All Set!</h2>
          <p className="band-dim mt-1 font-semibold">Your affiliate dashboard is ready.</p>
          <button type="button" onClick={goDashboard} className="mt-5 rounded-full bg-tang px-7 py-3.5 font-display text-lg font-semibold text-ink">
            Go to My Dashboard
          </button>
        </section>
      )}
    </div>
  );
}

/* --------------------------------- Login --------------------------------- */

export function AffiliateLoginPage({
  goDashboard,
  goRegister,
}: {
  goDashboard: () => void;
  goRegister: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const login = useMutation({
    mutationFn: async () => await api.affiliateLogin({ identifier: identifier.trim(), pin }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      saveAffiliateSession(res.sessionToken);
      goDashboard();
    },
  });
  const forgot = useMutation({
    mutationFn: async () => await api.affiliateRequestPinReset({ identifier: identifier.trim() }),
    onError: (e) => setError(e.message),
    onSuccess: () => setForgotSent(true),
  });
  return (
    <div className="mx-auto max-w-md px-4 pb-16">
      <section className="mt-4 rounded-[2rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--border)]" aria-label="Masuk afiliasi">
        <img src={logoUrl} alt="" className="mx-auto h-16 w-16 rounded-3xl object-cover ring-1 ring-black/10" />
        <h1 className="mt-3 text-center font-display text-2xl font-semibold">Masuk Dasbor Afiliasi</h1>
        <p className="mt-1 text-center font-semibold text-[var(--dim)]">
          Masukkan nomor HP yang kamu daftarkan dan PIN pribadi untuk masuk.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (!/^\d{4}$/.test(pin)) {
              setError("PIN harus tepat 4 digit angka.");
              return;
            }
            login.mutate();
          }}
        >
          <div>
            <label htmlFor="aff-id" className="font-display text-sm font-bold">Nomor HP terdaftar</label>
            <input
              id="aff-id"
              {...FIELDS.affiliateLogin.identifier}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="tel"
              type="tel"
              inputMode="tel"
              placeholder="081234567890"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="aff-pin" className="font-display text-sm font-bold">PIN 4 digit</label>
            <input
              id="aff-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className={pinCls}
            />
          </div>
          {error && <p className="text-sm font-bold text-berry" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={login.isPending || identifier.trim().replace(/\D/g, "").length < 9}
            className="w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-ink disabled:opacity-50"
          >
            {login.isPending ? "Memeriksa…" : "Masuk"}
          </button>
        </form>
        <div className="mt-4 border-t border-dashed border-[var(--border)] pt-3 text-center">
          {forgotSent ? (
            <p className="text-sm font-semibold text-[var(--dim)]" role="status">
              Permintaan reset PIN tercatat. Admin akan mengirim tautan reset (berlaku 1 jam, sekali pakai)
              lewat email/WhatsApp terdaftarmu — demi keamanan tautan tidak ditampilkan di halaman ini.
            </p>
          ) : (
            <button
              type="button"
              disabled={forgot.isPending || identifier.trim().replace(/\D/g, "").length < 9}
              onClick={() => {
                setError("");
                forgot.mutate();
              }}
              className="font-display text-sm font-bold text-sky-deep underline disabled:opacity-50"
            >
              Lupa PIN?
            </button>
          )}
          <p className="mt-3 text-xs font-semibold text-[var(--dim)]">
            Belum punya akun affiliate?{" "}
            <button type="button" onClick={goRegister} className="font-bold text-sky-deep underline">
              Daftar sekarang
            </button>
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
            5 kali PIN salah berturut-turut mengunci akun selama 15 menit.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------- PIN reset ------------------------------- */

export function AffiliateResetPage({
  token,
  goDashboard,
}: {
  token: string;
  goDashboard: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const reset = useMutation({
    mutationFn: async () => await api.resetPinWithToken({ token, pin }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      saveAffiliateSession(res.sessionToken);
      goDashboard();
    },
  });
  return (
    <div className="mx-auto max-w-md px-4 pb-16">
      <section className="mt-4 rounded-[2rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--border)]" aria-label="Atur ulang PIN">
        <h1 className="font-display text-2xl font-semibold">Atur Ulang PIN Afiliasi</h1>
        <p className="mt-1 font-semibold text-[var(--dim)]">
          Buat PIN baru 4 digit. Semua sesi lama otomatis keluar demi keamanan.
        </p>
        <div className="mt-4 space-y-3">
          <PinFields pin={pin} setPin={setPin} confirm={confirm} setConfirm={setConfirm} idPrefix="reset" />
        </div>
        {error && <p className="mt-3 text-sm font-bold text-berry" role="alert">{error}</p>}
        <button
          type="button"
          disabled={reset.isPending}
          onClick={() => {
            const err = pinFormError(pin, confirm);
            if (err) {
              setError(err);
              return;
            }
            setError("");
            reset.mutate();
          }}
          className="mt-4 w-full rounded-full bg-tang px-6 py-3.5 font-display text-lg font-semibold text-ink disabled:opacity-50"
        >
          {reset.isPending ? "Menyimpan…" : "Simpan PIN Baru & Masuk"}
        </button>
      </section>
    </div>
  );
}

/* ------------------------------- Dashboard ------------------------------- */

type MeData = ApiResponse<typeof api, "affiliateMe">;
type RangeId = "today" | "7d" | "30d" | "month" | "custom";

const COMMISSION_LABELS: Record<string, string> = {
  pending: "Menunggu pembayaran",
  confirmed: "Terkonfirmasi",
  payable: "Siap dicairkan",
  paid: "Sudah dibayar",
  reversed: "Dibalikkan (refund)",
};

const PAYOUT_LABELS: Record<string, string> = {
  requested: "Diminta",
  approved: "Disetujui",
  paid: "Sudah ditransfer",
  rejected: "Ditolak",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SalesChart({ me }: { me: MeData }) {
  const max = Math.max(1, ...me.series.map((s) => s.revenue));
  const W = 640;
  const H = 180;
  const barW = Math.max(4, Math.floor(W / Math.max(1, me.series.length)) - 4);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="h-auto w-full" role="img" aria-label="Grafik penjualan harian">
        {me.series.map((s, i) => {
          const x = (i * W) / Math.max(1, me.series.length) + 2;
          const h = Math.round((s.revenue / max) * (H - 18));
          return (
            <g key={s.date}>
              <rect x={x} y={H - h} width={barW} height={h} rx={3} fill={s.revenue > 0 ? "#667C3E" : "#E5DCCD"}>
                <title>{`${s.date}: ${s.orders} pesanan · ${formatIDR(s.revenue)} · komisi ${formatIDR(s.commission)}`}</title>
              </rect>
              {(i % Math.ceil(me.series.length / 6) === 0 || i === me.series.length - 1) && (
                <text x={x} y={H + 16} fontSize={11} fill="#716257" fontWeight={700}>
                  {s.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
        Batang = pendapatan produk bersih per hari. Arahkan kursor / tahan batang untuk detail pesanan &amp; komisi hari itu.
      </p>
    </div>
  );
}

export function AffiliateDashboard({
  goLogin,
  goHome,
}: {
  goLogin: () => void;
  goHome: () => void;
}) {
  const queryClient = useQueryClient();
  const [token] = useState(loadAffiliateSession);
  const [range, setRange] = useState<RangeId>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { from, to } = useMemo(() => {
    const today = new Date();
    if (range === "today") return { from: dayKey(today), to: dayKey(today) };
    if (range === "7d") return { from: dayKey(new Date(today.getTime() - 6 * 86400000)), to: dayKey(today) };
    if (range === "month") return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dayKey(today) };
    if (range === "custom") return { from: customFrom, to: customTo };
    return { from: dayKey(new Date(today.getTime() - 29 * 86400000)), to: dayKey(today) };
  }, [range, customFrom, customTo]);
  const me = useQuery({
    queryKey: ["affiliateMe", token, from, to],
    queryFn: () => api.affiliateMe({ sessionToken: token, from, to }),
    enabled: token.length >= 8,
  });
  const logout = useMutation({
    mutationFn: async () => await api.affiliateLogout({ sessionToken: token }),
    onSettled: () => {
      saveAffiliateSession("");
      queryClient.removeQueries({ queryKey: ["affiliateMe"] });
      goLogin();
    },
  });
  const [editingCoupon, setEditingCoupon] = useState(false);
  const [couponDraft, setCouponDraft] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const changeCoupon = useMutation({
    mutationFn: async () => await api.affiliateUpdateCoupon({
      sessionToken: token,
      couponCode: couponDraft.trim().toUpperCase(),
    }),
    onError: (e) => setCouponMessage(e instanceof Error ? e.message : "Kode kupon tidak dapat diubah."),
    onSuccess: async (res) => {
      setCouponDraft(res.affiliate.couponCode);
      setCouponMessage("Kode kupon berhasil diperbarui. Bagikan tautan referral terbaru.");
      setEditingCoupon(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["affiliateMe"] }),
        queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] }),
      ]);
    },
  });
  const [payoutAmount, setPayoutAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payoutMsg, setPayoutMsg] = useState("");
  const requestPayout = useMutation({
    mutationFn: async () =>
      await api.affiliateRequestPayout({
        sessionToken: token,
        amount: Number(payoutAmount),
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
      }),
    onError: (e) => setPayoutMsg(e.message),
    onSuccess: () => {
      setPayoutMsg("Permintaan penarikan terkirim. Admin akan meninjaunya — statusnya tampil di riwayat pencairan di bawah.");
      setPayoutAmount("");
      queryClient.invalidateQueries({ queryKey: ["affiliateMe"] });
    },
  });

  if (token.length < 8) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold">Kamu belum masuk sebagai afiliasi.</p>
        <p className="mt-2 font-semibold text-[var(--dim)]">Dasbor privat — masuk dengan nomor HP terdaftar dan PIN kamu.</p>
        <button type="button" onClick={goLogin} className="mt-5 rounded-full bg-olive px-6 py-3 font-display text-base font-semibold text-white">
          Ke Halaman Masuk
        </button>
      </div>
    );
  }
  if (me.isPending) return <p className="mx-auto max-w-md px-4 py-16 text-center font-display font-bold">Memuat dasbormu…</p>;
  if (me.error || !me.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold">Sesi tidak berlaku lagi</p>
        <p className="mt-2 font-semibold text-[var(--dim)]">{me.error?.message ?? "Masuk lagi untuk melanjutkan."}</p>
        <button
          type="button"
          onClick={() => {
            saveAffiliateSession("");
            goLogin();
          }}
          className="mt-5 rounded-full bg-olive px-6 py-3 font-display text-base font-semibold text-white"
        >
          Masuk Lagi
        </button>
      </div>
    );
  }
  const d = me.data;
  const a = d.affiliate;
  const kpiPctOrders = d.kpi.targetOrders > 0 ? Math.min(100, Math.round((d.kpi.monthOrders / d.kpi.targetOrders) * 100)) : 0;
  const rangeBtn = (id: RangeId, label: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={range === id}
      onClick={() => setRange(id)}
      className={`rounded-full px-4 py-2 font-display text-sm font-bold ${range === id ? "bg-sky-deep text-white" : "bg-[var(--bg)] ring-1 ring-[var(--border)]"}`}
    >
      {label}
    </button>
  );
  const statCard = (label: string, value: string, sub: string) => (
    <div className="rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dim)]">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-olive-deep">{value}</p>
      <p className="text-xs font-semibold text-[var(--dim)]">{sub}</p>
    </div>
  );
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <div className="band-sage mt-4 rounded-[2rem] px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Hello, {a.name}!</h1>
            <p className="band-dim mt-1 font-semibold">Here&rsquo;s how your little partnership is growing.</p>
            <p className="mt-2">
              <span className={`rounded-full px-3 py-1 font-display text-xs font-bold ${a.status === "active" ? "bg-olive text-white" : "bg-butter text-ink"}`}>
                Status akun: {a.status === "active" ? "Aktif" : a.status === "suspended" ? "Ditangguhkan" : "Menunggu aktivasi"}
              </span>
            </p>
          </div>
          <button type="button" onClick={() => logout.mutate()} className="rounded-full bg-white px-4 py-2 font-display text-sm font-bold text-ink ring-1 ring-black/5">
            Keluar
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-white p-4 ring-1 ring-black/5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dim)]">Kode kupon kamu</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-wide">{a.couponCode}</p>
            <p className="text-sm font-semibold text-[var(--dim)]">
              Diskon standar pelanggan {a.discountPct}% · komisi kamu {a.commissionPct}% dari subtotal bersih
            </p>
            {catalogProductIds.some((id) => d.productDiscounts[id] !== undefined) && (
              <ul className="mt-2 text-sm text-[var(--dim)]" aria-label="Diskon khusus per produk">
                {catalogProductIds.map((id) => d.productDiscounts[id] === undefined ? null : (
                  <li key={id}>{PRODUCT_META[id].title} · {d.productDiscounts[id]}%</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton text={a.couponCode} label="Salin Kode Kupon" />
              {!editingCoupon && (
                <button type="button"
                  onClick={() => { setCouponDraft(a.couponCode); setCouponMessage(""); setEditingCoupon(true); }}
                  className="rounded-full bg-[var(--surface-alt)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)]">
                  Ubah Kode Kupon
                </button>
              )}
            </div>
            {editingCoupon && (
              <form className="mt-3 space-y-2 rounded-2xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  setCouponMessage("");
                  if (!/^[A-Z0-9_-]{3,24}$/.test(couponDraft.trim().toUpperCase())) {
                    setCouponMessage("Kode harus 3–24 karakter: huruf, angka, - atau _.");
                    return;
                  }
                  changeCoupon.mutate();
                }}>
                <label htmlFor="aff-custom-coupon" className="font-display text-sm font-bold">Kode kupon pilihanmu</label>
                <input id="aff-custom-coupon" type="text" autoCapitalize="characters"
                  value={couponDraft} maxLength={24}
                  onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                  className="w-full rounded-xl bg-white px-4 py-3 font-display font-bold uppercase ring-1 ring-[var(--border)]"
                  placeholder="Contoh: BUNFADHIL" />
                <p className="text-xs font-semibold text-[var(--dim)]">
                  Harus unik. Kode lama dan link referral lama tidak berlaku untuk order berikutnya.
                  Riwayat pesanan dan komisi sebelumnya tetap tersimpan.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={changeCoupon.isPending || couponDraft.trim().toUpperCase() === a.couponCode}
                    className="rounded-full bg-olive px-4 py-2 font-display text-xs font-bold text-white disabled:opacity-50">
                    {changeCoupon.isPending ? "Menyimpan…" : "Simpan Kode"}
                  </button>
                  <button type="button" disabled={changeCoupon.isPending}
                    onClick={() => { setEditingCoupon(false); setCouponMessage(""); }}
                    className="rounded-full bg-white px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)]">
                    Batal
                  </button>
                </div>
              </form>
            )}
            {couponMessage && <p className="mt-2 text-xs font-bold text-olive-deep" role="status">{couponMessage}</p>}
          </div>
          <div className="rounded-3xl bg-white p-4 ring-1 ring-black/5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dim)]">Tautan referral kamu</p>
            <p className="mt-1 break-all font-display text-base font-bold">{referralLink(a.couponCode)}</p>
            <p className="text-sm font-semibold text-[var(--dim)]">
              Bagikan link lengkap ini langsung ke Instagram, TikTok, atau WhatsApp. Kode referral kamu akan tersimpan saat pengunjung membuka link.
            </p>
            <div className="mt-2">
              <CopyButton text={referralLink(a.couponCode)} label="Copy Referral Link" />
            </div>
          </div>
        </div>
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Statistik utama">
        {statCard("Total Sales", String(d.totalSales), "pesanan teratribusi & terbayar")}
        {statCard("Total Revenue", formatIDR(d.totalRevenue), "pendapatan produk bersih")}
        {statCard("My Commission", formatIDR(d.totalCommission), "total komisi yang kamu hasilkan")}
        {statCard("Available Payout", formatIDR(d.availablePayout), "komisi selesai & siap dicairkan")}
      </section>

      <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Analitik penjualan">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">Analitik penjualan</h2>
          <div className="flex flex-wrap gap-1.5">
            {rangeBtn("today", "Hari ini")}
            {rangeBtn("7d", "7 hari")}
            {rangeBtn("30d", "30 hari")}
            {rangeBtn("month", "Bulan ini")}
            {rangeBtn("custom", "Kustom")}
          </div>
        </div>
        {range === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="range-from" className="font-display text-xs font-bold text-[var(--dim)]">Dari tanggal</label>
              <input id="range-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-0.5 rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
            </div>
            <div>
              <label htmlFor="range-to" className="font-display text-xs font-bold text-[var(--dim)]">Sampai tanggal</label>
              <input id="range-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-0.5 rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
            </div>
          </div>
        )}
        <div className="mt-3">
          <SalesChart me={d} />
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="KPI bulanan">
          <h2 className="font-display text-lg font-extrabold">KPI bulan ini</h2>
          {d.kpi.configured ? (
            <div className="mt-2 space-y-2 font-semibold">
              <div className="flex justify-between"><span className="text-[var(--dim)]">Target pesanan</span><span className="font-display">{d.kpi.targetOrders}</span></div>
              <div className="flex justify-between"><span className="text-[var(--dim)]">Pesanan selesai bulan ini</span><span className="font-display">{d.kpi.monthOrders}</span></div>
              <div className="flex justify-between"><span className="text-[var(--dim)]">Pendapatan bulan ini</span><span className="font-display">{formatIDR(d.kpi.monthRevenue)}</span></div>
              {d.kpi.targetRevenue > 0 && (
                <div className="flex justify-between"><span className="text-[var(--dim)]">Target pendapatan</span><span className="font-display">{formatIDR(d.kpi.targetRevenue)}</span></div>
              )}
              <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-alt)]" role="progressbar" aria-valuenow={kpiPctOrders} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan target pesanan">
                <div className="h-full rounded-full bg-olive" style={{ width: `${kpiPctOrders}%` }} />
              </div>
              <p className="text-sm text-[var(--dim)]">
                Kemajuan target pesanan {kpiPctOrders}% · sisa {Math.max(0, d.kpi.targetOrders - d.kpi.monthOrders)} pesanan lagi.
                {kpiPctOrders >= 100 ? " Target tercapai bulan ini — kerja bagus!" : ""}
              </p>
            </div>
          ) : (
            <p className="mt-2 font-semibold text-[var(--dim)]">
              Target KPI bulan ini belum diatur admin. Begitu diatur, kemajuanmu tampil di sini — kami tidak menampilkan target karangan.
            </p>
          )}
        </section>

        <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Dompet komisi">
          <h2 className="font-display text-lg font-extrabold">Dompet komisi</h2>
          <dl className="mt-2 space-y-1.5 font-semibold">
            <div className="flex justify-between"><dt className="text-[var(--dim)]">Menunggu (pesanan belum lunas)</dt><dd className="font-display">{formatIDR(d.wallet.pending)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--dim)]">Terkonfirmasi (pembayaran terverifikasi)</dt><dd className="font-display">{formatIDR(d.wallet.confirmed)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--dim)]">Siap dicairkan (pesanan selesai)</dt><dd className="font-display text-olive-deep">{formatIDR(d.wallet.payable)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--dim)]">Sudah dibayar</dt><dd className="font-display">{formatIDR(d.wallet.paid)}</dd></div>
          </dl>
          <div className="mt-4 border-t border-dashed border-[var(--border)] pt-3">
            <h3 className="font-display text-base font-semibold">Request Withdrawal</h3>
            <p className="text-xs font-semibold text-[var(--dim)]">
              Minimum penarikan {formatIDR(d.minWithdrawal)}. Komisi menjadi siap dicairkan setelah pembayaran
              terverifikasi DAN pesanan selesai. Mengganti tujuan pencairan di luar data yang kamu kirim di sini
              memerlukan verifikasi ulang oleh admin.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="po-amount" className="font-display text-xs font-bold text-[var(--dim)]">Jumlah (Rp)</label>
                <input id="po-amount" {...FIELDS.affiliateRequestPayout.amount} type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="mt-0.5 w-full rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
              </div>
              <div>
                <label htmlFor="po-bank" className="font-display text-xs font-bold text-[var(--dim)]">Bank / e-wallet</label>
                <input id="po-bank" {...FIELDS.affiliateRequestPayout.bankName} value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-0.5 w-full rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
              </div>
              <div>
                <label htmlFor="po-accname" className="font-display text-xs font-bold text-[var(--dim)]">Nama pemilik rekening</label>
                <input id="po-accname" {...FIELDS.affiliateRequestPayout.accountName} value={accountName} onChange={(e) => setAccountName(e.target.value)} className="mt-0.5 w-full rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
              </div>
              <div>
                <label htmlFor="po-accnum" className="font-display text-xs font-bold text-[var(--dim)]">Nomor rekening</label>
                <input id="po-accnum" {...FIELDS.affiliateRequestPayout.accountNumber} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-0.5 w-full rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
              </div>
            </div>
            {payoutMsg && <p className="mt-2 text-sm font-bold text-olive-deep" role="status">{payoutMsg}</p>}
            <button
              type="button"
              disabled={requestPayout.isPending || d.availablePayout < d.minWithdrawal}
              onClick={() => {
                if (!payoutAmount || Number(payoutAmount) <= 0) return setPayoutMsg("Isi jumlah penarikannya dulu ya.");
                if (bankName.trim().length < 2 || accountName.trim().length < 2 || accountNumber.trim().length < 4) {
                  return setPayoutMsg("Lengkapi data tujuan pencairannya dulu ya.");
                }
                setPayoutMsg("");
                requestPayout.mutate();
              }}
              className="mt-3 rounded-full bg-tang px-6 py-3 font-display text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requestPayout.isPending ? "Mengirim…" : "Request Withdrawal"}
            </button>
            {d.availablePayout < d.minWithdrawal && (
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">Saldo siap cair belum mencapai minimum penarikan.</p>
            )}
          </div>
          <div className="mt-4 border-t border-dashed border-[var(--border)] pt-3">
            <h3 className="font-display text-base font-semibold">Riwayat pencairan</h3>
            {d.payouts.length === 0 ? (
              <p className="mt-1 text-sm font-semibold text-[var(--dim)]">Belum ada pencairan.</p>
            ) : (
              <ul className="mt-1 space-y-1.5 text-sm font-semibold">
                {d.payouts.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span>{new Date(p.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })} · {formatIDR(p.amount)}</span>
                    <span className="font-display">{PAYOUT_LABELS[p.status] ?? p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Riwayat pesanan afiliasi">
        <h2 className="font-display text-lg font-extrabold">Pesanan dari kuponmu</h2>
        <p className="text-sm font-semibold text-[var(--dim)]">
          Hanya ringkasan penjualan — data pribadi pelanggan tidak pernah ditampilkan di dasbor afiliasi.
        </p>
        {d.orders.length === 0 ? (
          <p className="mt-3 font-semibold text-[var(--dim)]">Belum ada pesanan yang memakai kuponmu. Bagikan kode {a.couponCode} untuk mulai.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm font-semibold">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--dim)]">
                  <th className="py-2 pr-3">Tanggal</th>
                  <th className="py-2 pr-3">Referensi</th>
                  <th className="py-2 pr-3">Produk</th>
                  <th className="py-2 pr-3">Subtotal bersih</th>
                  <th className="py-2 pr-3">Komisi</th>
                  <th className="py-2">Status komisi</th>
                </tr>
              </thead>
              <tbody>
                {d.orders.map((o, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/60">
                    <td className="py-2 pr-3">{new Date(o.date).toLocaleDateString("id-ID", { dateStyle: "medium" })}</td>
                    <td className="py-2 pr-3 font-display">{o.maskedCode}</td>
                    <td className="py-2 pr-3">{o.productLabel}</td>
                    <td className="py-2 pr-3">{formatIDR(o.netSubtotal)}</td>
                    <td className="py-2 pr-3 font-display text-olive-deep">{formatIDR(o.commission)}</td>
                    <td className="py-2">{COMMISSION_LABELS[o.status] ?? o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" onClick={goHome} className="mt-4 rounded-full bg-[var(--surface-alt)] px-5 py-2.5 font-display text-sm font-bold ring-1 ring-[var(--border)]">
          ← Kembali ke Beranda
        </button>
      </section>
    </div>
  );
}

/* --------------------------- Admin management --------------------------- */

type AdminAffiliate = ApiResponse<typeof api, "adminListAffiliates">["affiliates"][number];

const catalogProductIds = Object.keys(PRODUCT_META) as ProductId[];

function AffiliateProductDiscounts({ account }: { account: AdminAffiliate }) {
  const queryClient = useQueryClient();
  const [productType, setProductType] = useState<ProductId>("papercraft");
  const [draft, setDraft] = useState<string | null>(null);
  const current = account.productDiscounts[productType];
  const value = draft ?? (current === undefined ? "" : String(current));
  const save = useMutation({
    mutationFn: () => api.adminSetAffiliateProductDiscount({
      affiliateId: account.id,
      productType,
      discountPct: value === "" ? null : Number(value),
    }),
    onSuccess: ({ productDiscounts }) => {
      queryClient.setQueryData<{ affiliates: AdminAffiliate[] }>(["adminAffiliates"], (list) => list && ({
        affiliates: list.affiliates.map((a) => a.id === account.id ? { ...a, productDiscounts } : a),
      }));
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["affiliateAudit"] });
    },
  });

  return (
    <details className="mt-3 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]">
      <summary className="cursor-pointer font-display text-sm font-bold">Diskon kupon per produk</summary>
      <p className="mt-2 text-sm text-[var(--dim)]">
        Kosongkan untuk memakai diskon standar {account.discountPct}%. Isi 0 jika produk ini tidak mendapat potongan.
      </p>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!save.isPending) save.mutate();
      }}>
        <label className="grid gap-0.5 text-xs font-bold">
          Produk
          <select className={inputCls} value={productType} disabled={save.isPending} onChange={(event) => {
            setProductType(event.target.value as ProductId);
            setDraft(null);
            save.reset();
          }}>
            {catalogProductIds.map((id) => (
              <option key={id} value={id}>
                {PRODUCT_META[id].title}{account.productDiscounts[id] !== undefined ? ` · ${account.productDiscounts[id]}%` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-0.5 text-xs font-bold">
          Diskon khusus (%)
          <input type="number" min={0} max={90} step={1} inputMode="numeric" value={value}
            disabled={save.isPending} className={`w-28 ${inputCls}`}
            onChange={(event) => { setDraft(event.target.value); save.reset(); }} />
        </label>
        <button type="submit" disabled={save.isPending} className="rounded-full bg-olive px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {save.isPending ? "Menyimpan…" : "Simpan diskon produk"}
        </button>
      </form>
      {save.isError && <p role="alert" className="mt-2 text-sm text-berry">{save.error.message}</p>}
      {save.isSuccess && <p role="status" className="mt-2 text-sm text-olive-deep">Diskon produk tersimpan.</p>}
    </details>
  );
}


const INVITE_LABELS: Record<AdminAffiliate["inviteState"], string> = {
  none: "Belum ada undangan",
  pending: "Undangan menunggu aktivasi",
  used: "Sudah diaktivasi",
  expired: "Undangan kedaluwarsa",
  revoked: "Undangan dicabut",
};

function AdminAffiliateCard({ a }: { a: AdminAffiliate }) {
  const queryClient = useQueryClient();
  const [discountPct, setDiscountPct] = useState(String(a.discountPct));
  const [commissionPct, setCommissionPct] = useState(String(a.commissionPct));
  const [couponCode, setCouponCode] = useState(a.couponCode);
  const [kpiOrders, setKpiOrders] = useState(String(a.kpiTargetOrders));
  const [kpiRevenue, setKpiRevenue] = useState(String(a.kpiTargetRevenue));
  const [msg, setMsg] = useState("");
  const [freshToken, setFreshToken] = useState("");
  const [resetInfo, setResetInfo] = useState<{ token: string; expires: string | null } | null>(null);
  const update = useMutation({
    mutationFn: async () =>
      await api.adminUpdateAffiliate({
        id: a.id,
        couponCode: couponCode.trim().toUpperCase(),
        discountPct: Number(discountPct),
        commissionPct: Number(commissionPct),
        kpiTargetOrders: Number(kpiOrders),
        kpiTargetRevenue: Number(kpiRevenue),
      }),
    onError: (e) => setMsg(e.message),
    onSuccess: () => {
      setMsg("Tersimpan ✓");
      queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const setStatus = useMutation({
    mutationFn: async (status: "active" | "suspended" | "pending") => await api.adminUpdateAffiliate({ id: a.id, status }),
    onError: (e) => setMsg(e.message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] }),
  });
  const regen = useMutation({
    mutationFn: async () => await api.adminRegenerateInvite({ affiliateId: a.id }),
    onError: (e) => setMsg(e.message),
    onSuccess: (res) => {
      setFreshToken(res.inviteToken);
      setMsg("Tautan aktivasi akun lama dibuat. Kirim secara pribadi ke kontak yang sudah tercatat.");
      queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const revoke = useMutation({
    mutationFn: async () => await api.adminRevokeInvite({ affiliateId: a.id }),
    onError: (e) => setMsg(e.message),
    onSuccess: () => {
      setFreshToken("");
      queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const loadReset = useMutation({
    mutationFn: async () => await api.adminGetPinReset({ affiliateId: a.id }),
    onError: (e) => setMsg(e.message),
    onSuccess: (res) => setResetInfo({ token: res.resetToken, expires: res.resetExpiresAt }),
  });
  const shownToken = freshToken || a.inviteToken;
  const waDigits = a.whatsapp.replace(/\D/g, "");
  const waInternational = waDigits.startsWith("0") ? `62${waDigits.slice(1)}` : waDigits;
  const activationUrl = typeof window === "undefined" ? inviteLink(shownToken) : `${window.location.origin}/${inviteLink(shownToken)}`;
  const numCls = "w-24 rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]";
  return (
    <article className="rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold">
            {a.name} <span className="text-sm font-bold text-[var(--dim)]">· {a.email}</span>
          </p>
          <p className="text-sm font-semibold text-[var(--dim)]">
            Terdaftar {new Date(a.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
            {a.whatsapp && ` · WA ${a.whatsapp}`}
            {a.instagram && ` · IG @${a.instagram}`}
            {a.tiktok && ` · TikTok @${a.tiktok}`}
          </p>
          <p className="text-sm font-semibold text-[var(--dim)]">
            Status akun: <span className="font-display text-ink">{a.status === "active" ? "Aktif" : a.status === "suspended" ? "Ditangguhkan" : "Menunggu aktivasi"}</span>
            {" · "}{a.hasPin ? "PIN sudah diatur · akses dashboard tersedia" : INVITE_LABELS[a.inviteState]}
            {a.pinResetRequested && " · Meminta reset PIN"}
          </p>
          <p className="text-sm font-semibold text-[var(--dim)]">
            {a.totalOrders} pesanan terbayar · penjualan bersih {formatIDR(a.netSales)} · total komisi {formatIDR(a.totalCommission)} · penarikan menunggu {formatIDR(a.pendingPayout)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.status !== "suspended" ? (
            <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate("suspended")} className="rounded-full bg-berry px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">
              Tangguhkan
            </button>
          ) : (
            <button type="button" disabled={setStatus.isPending} onClick={() => setStatus.mutate("active")} className="rounded-full bg-olive px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">
              Aktifkan Lagi
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-dashed border-[var(--border)] pt-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor={`af-coupon-${a.id}`} className="font-display text-xs font-bold text-[var(--dim)]">Kode kupon</label>
          <input id={`af-coupon-${a.id}`} {...FIELDS.adminUpdateAffiliate.couponCode} value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="mt-0.5 w-full rounded-xl bg-[var(--bg)] px-3 py-2 font-display text-sm font-bold uppercase ring-1 ring-[var(--border)]" />
        </div>
        <div>
          <label htmlFor={`af-disc-${a.id}`} className="font-display text-xs font-bold text-[var(--dim)]">Diskon standar (%)</label>
          <input id={`af-disc-${a.id}`} {...FIELDS.adminUpdateAffiliate.discountPct} type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={`mt-0.5 ${numCls}`} />
        </div>
        <div>
          <label htmlFor={`af-comm-${a.id}`} className="font-display text-xs font-bold text-[var(--dim)]">Komisi afiliasi %</label>
          <input id={`af-comm-${a.id}`} {...FIELDS.adminUpdateAffiliate.commissionPct} type="number" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} className={`mt-0.5 ${numCls}`} />
        </div>
        <div>
          <label htmlFor={`af-kpio-${a.id}`} className="font-display text-xs font-bold text-[var(--dim)]">Target KPI: pesanan/bln</label>
          <input id={`af-kpio-${a.id}`} {...FIELDS.adminUpdateAffiliate.kpiTargetOrders} type="number" value={kpiOrders} onChange={(e) => setKpiOrders(e.target.value)} className={`mt-0.5 ${numCls}`} />
        </div>
        <div>
          <label htmlFor={`af-kpir-${a.id}`} className="font-display text-xs font-bold text-[var(--dim)]">Target KPI: pendapatan/bln (Rp)</label>
          <input id={`af-kpir-${a.id}`} {...FIELDS.adminUpdateAffiliate.kpiTargetRevenue} type="number" value={kpiRevenue} onChange={(e) => setKpiRevenue(e.target.value)} className={`mt-0.5 ${numCls}`} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={update.isPending} onClick={() => update.mutate()} className="rounded-full bg-sky-deep px-5 py-2.5 font-display text-sm font-semibold text-white disabled:opacity-50">
          {update.isPending ? "Menyimpan…" : "Simpan kupon, tarif & KPI"}
        </button>
        {msg && <span className="text-sm font-bold text-olive-deep" role="status">{msg}</span>}
      </div>

      <AffiliateProductDiscounts account={a} />

      {!a.hasPin && (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border)] pt-3">
        <span className="font-display text-xs font-bold text-[var(--dim)]">Aktivasi akun lama:</span>
        {shownToken ? (
          <>
            <code className="max-w-full break-all rounded-xl bg-[var(--surface)] px-3 py-1.5 text-xs font-bold ring-1 ring-[var(--border)]">{activationUrl}</code>
            <CopyButton text={activationUrl} label="Salin Tautan Aktivasi" />
            <a
              href={`https://wa.me/${waInternational}?text=${encodeURIComponent(`Halo ${a.name}, akun affiliate Bun & Fleur Kids kamu sudah disiapkan. Klik tautan aktivasi pribadi ini untuk membuat PIN: ${activationUrl} (berlaku 72 jam dan hanya bisa dipakai satu kali).`)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)]"
            >
              Kirim via WhatsApp
            </a>
          </>
        ) : (
          <span className="text-sm font-semibold text-[var(--dim)]">Tidak ada tautan aktif.</span>
        )}
        <button type="button" disabled={regen.isPending}
          onClick={() => regen.mutate()}
          className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)] disabled:opacity-50">
          {regen.isPending ? "Menyiapkan…" : a.inviteState === "expired" ? "Buat Ulang (kedaluwarsa)" : "Buat Tautan Aktivasi Akun Lama"}
        </button>
        {shownToken && (
          <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate()} className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold text-berry ring-1 ring-[var(--border)] disabled:opacity-50">
            Cabut Undangan
          </button>
        )}
        {a.inviteExpiresAt && a.inviteState === "pending" && (
          <span className="text-xs font-semibold text-[var(--dim)]">Berlaku sampai {new Date(a.inviteExpiresAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
        )}
      </div>
      )}

      {a.pinResetRequested && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--border)] pt-3">
          <span className="font-display text-xs font-bold text-[var(--dim)]">Reset PIN diminta:</span>
          <button type="button" disabled={loadReset.isPending} onClick={() => loadReset.mutate()} className="rounded-full bg-[var(--surface)] px-4 py-2 font-display text-xs font-bold ring-1 ring-[var(--border)] disabled:opacity-50">
            Ambil Tautan Reset
          </button>
          {resetInfo && resetInfo.token && (
            <>
              <code className="max-w-full break-all rounded-xl bg-[var(--surface)] px-3 py-1.5 text-xs font-bold ring-1 ring-[var(--border)]">{resetLink(resetInfo.token)}</code>
              <CopyButton text={resetLink(resetInfo.token)} label="Salin Tautan Reset" />
              <span className="text-xs font-semibold text-[var(--dim)]">Kirim HANYA lewat email/WhatsApp terdaftar afiliasi ini. Berlaku 1 jam, sekali pakai.</span>
            </>
          )}
          {resetInfo && !resetInfo.token && (
            <span className="text-xs font-semibold text-[var(--dim)]">Token reset sudah kedaluwarsa — minta afiliasi menekan “Lupa PIN” lagi.</span>
          )}
        </div>
      )}
    </article>
  );
}

export function AffiliateAdmin() {
  const queryClient = useQueryClient();
  const affiliates = useQuery({
    queryKey: ["adminAffiliates"],
    queryFn: () => api.adminListAffiliates({}),
    retry: false,
  });
  const listUnavailable = affiliates.isError || affiliates.isPaused;
  const payouts = useQuery({ queryKey: ["adminPayouts"], queryFn: () => api.adminListPayouts({ limit: 50 }) });
  const config = useQuery({ queryKey: ["affiliateConfig"], queryFn: () => api.getAffiliateConfig({}) });
  const auditLog = useQuery({ queryKey: ["affiliateAudit"], queryFn: () => api.adminListAffiliateAudit({ limit: 20 }) });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "suspended">("all");
  const rows = affiliates.data?.affiliates ?? [];
  const filtered = rows.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    const needle = search.trim().toLowerCase();
    return !needle || [a.name, a.whatsapp, a.email, a.couponCode, a.instagram, a.tiktok]
      .some((v) => v.toLowerCase().includes(needle));
  });
  const total = (name: "netSales" | "totalOrders" | "totalCommission" | "pendingPayout") =>
    rows.reduce((sum, a) => sum + a[name], 0);
  const metrics = [
    { label: "Total Affiliate", value: String(rows.length), hint: "Seluruh akun terdaftar" },
    { label: "Akun Aktif", value: String(rows.filter((a) => a.status === "active").length), hint: "Bisa login & membagikan kode" },
    { label: "Pesanan Terbayar", value: String(total("totalOrders")), hint: "Pesanan yang menghasilkan komisi" },
    { label: "Penjualan Bersih", value: formatIDR(total("netSales")), hint: "Dari kode affiliate" },
    { label: "Total Komisi", value: formatIDR(total("totalCommission")), hint: "Komisi atas pesanan terbayar" },
    { label: "Pencairan Diproses", value: formatIDR(total("pendingPayout")), hint: "Permintaan yang belum selesai" },
  ];
  const leaders = [...rows].sort((a, b) => b.netSales - a.netSales).slice(0, 5);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", instagram: "", tiktok: "", couponCode: "", discountPct: "10", commissionPct: "30" });
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const create = useMutation({
    mutationFn: async () =>
      await api.adminCreateAffiliate({
        fullName: form.name.trim(),
        email: form.email.trim(),
        whatsapp: form.whatsapp.trim(),
        instagram: form.instagram.trim(),
        tiktok: form.tiktok.trim(),
        couponCode: form.couponCode.trim().toUpperCase(),
        discountPct: Number(form.discountPct),
        commissionPct: Number(form.commissionPct),
      }),
    onError: (e) => setError(e.message),
    onSuccess: (res) => {
      setError("");
      setCreated({ name: res.affiliate.name, token: res.inviteToken });
      setForm({ name: "", email: "", whatsapp: "", instagram: "", tiktok: "", couponCode: "", discountPct: "10", commissionPct: "30" });
      queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const [minWithdrawal, setMinWithdrawal] = useState("");
  const [inviteHours, setInviteHours] = useState("");
  useEffect(() => {
    if (config.data) {
      setMinWithdrawal(String(config.data.minWithdrawal));
      setInviteHours(String(config.data.inviteExpiryHours));
    }
  }, [config.data]);
  const saveConfig = useMutation({
    mutationFn: async () =>
      await api.updateAffiliateConfig({ minWithdrawal: Number(minWithdrawal), inviteExpiryHours: Number(inviteHours) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["affiliateConfig"] }),
  });
  const payoutAction = useMutation({
    mutationFn: async (args: { id: number; decision: "approve" | "reject" | "paid" }) =>
      await api.adminUpdatePayout({ id: args.id, decision: args.decision, note: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPayouts"] });
      queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
    },
  });
  const setF = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Ringkasan dashboard affiliate">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.15em] text-olive-deep">Dashboard Admin</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold">Ringkasan Program Afiliasi</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--dim)]">Pantau performa mitra, kode referral, komisi, pencairan, dan keamanan akun.</p>
          </div>
          <button type="button" onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["adminAffiliates"] });
            void queryClient.invalidateQueries({ queryKey: ["adminPayouts"] });
            void queryClient.invalidateQueries({ queryKey: ["affiliateAudit"] });
          }} className="rounded-full bg-[var(--surface-alt)] px-5 py-2.5 font-display text-sm font-bold ring-1 ring-[var(--border)]">
            Perbarui Data
          </button>
        </div>
        {affiliates.isPending && !listUnavailable ? (
          <p className="mt-4 text-sm font-semibold text-[var(--dim)]">Memuat ringkasan…</p>
        ) : listUnavailable && !affiliates.data ? (
          <p className="mt-4 text-sm font-semibold text-berry">Ringkasan afiliasi belum tersedia.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-2xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
                <p className="font-display text-xs font-bold text-[var(--dim)]">{m.label}</p>
                <p className="mt-2 font-display text-2xl font-extrabold text-olive-deep">{m.value}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--dim)]">{m.hint}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-3xl bg-[#EEF4E4] p-5 ring-1 ring-olive/20">
        <p className="font-display text-lg font-extrabold text-olive-deep">Link Pendaftaran Affiliate Umum</p>
        <p className="mt-1 text-sm font-semibold text-[var(--dim)]">
          Satu link untuk semua KOL. Mitra langsung membuat PIN sendiri saat mendaftar dan akun aktif otomatis.
          Admin mengelola komisi, kupon, KPI, laporan, pencairan, serta penangguhan akun.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="max-w-full break-all rounded-xl bg-white px-3 py-2 text-xs font-bold">
            {typeof window === "undefined" ? "#/affiliate/daftar" : `${window.location.origin}/#/affiliate/daftar`}
          </code>
          <CopyButton
            text={typeof window === "undefined" ? "#/affiliate/daftar" : `${window.location.origin}/#/affiliate/daftar`}
            label="Salin Link Pendaftaran Umum"
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-olive-deep">
          Pendaftaran mandiri tidak memerlukan undangan atau verifikasi WhatsApp.
        </p>
      </div>
      <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Affiliate dengan penjualan terbanyak">
        <h3 className="font-display text-lg font-extrabold">Affiliate Teratas</h3>
        <p className="mt-1 text-sm font-semibold text-[var(--dim)]">Urutan berdasarkan nilai penjualan bersih yang sudah terbayar.</p>
        <div className="mt-3 space-y-2">
          {leaders.length === 0 && <p className="text-sm font-semibold text-[var(--dim)]">Belum ada mitra terdaftar.</p>}
          {leaders.map((a, index) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-4 py-3">
              <p className="text-sm font-bold"><span className="mr-3 font-display text-olive-deep">#{index + 1}</span>{a.name}</p>
              <p className="font-display text-sm font-bold">{formatIDR(a.netSales)} <span className="text-xs text-[var(--dim)]">({a.totalOrders} pesanan)</span></p>
            </div>
          ))}
        </div>
      </section>

      <details className="rounded-3xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
        <summary className="cursor-pointer font-display text-sm font-bold text-[var(--dim)]">
          Undangan manual untuk akun lama (opsional)
        </summary>
      <form
        className="mt-3 rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]"
        aria-label="Undang afiliasi baru"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (form.name.trim().length < 2) return setError("Isi nama lengkap afiliasinya dulu.");
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Format email belum benar.");
          const whatsapp = form.whatsapp.trim();
          if (!/^[+0-9() .-]+$/.test(whatsapp) || whatsapp.replace(/\D/g, "").length < 9 || whatsapp.replace(/\D/g, "").length > 15) {
            return setError("Nomor WhatsApp harus 9–15 digit angka, misalnya 081234567890.");
          }
          if (form.couponCode.trim().length < 3) return setError("Kode kupon minimal 3 karakter.");
          create.mutate();
        }}
      >
        <h3 className="font-display text-base font-semibold">Affiliate Management → Invite Affiliate</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="na-name" className="font-display text-xs font-bold text-[var(--dim)]">Nama lengkap</label>
            <input id="na-name" {...FIELDS.adminCreateAffiliate.fullName} value={form.name} onChange={setF("name")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="na-email" className="font-display text-xs font-bold text-[var(--dim)]">Email</label>
            <input id="na-email" {...FIELDS.adminCreateAffiliate.email} type="email" value={form.email} onChange={setF("email")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="na-wa" className="font-display text-xs font-bold text-[var(--dim)]">WhatsApp</label>
            <input id="na-wa" {...FIELDS.adminCreateAffiliate.whatsapp} type="tel" value={form.whatsapp} onChange={setF("whatsapp")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="na-ig" className="font-display text-xs font-bold text-[var(--dim)]">Instagram (opsional)</label>
            <input id="na-ig" {...FIELDS.adminCreateAffiliate.instagram} value={form.instagram} onChange={setF("instagram")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="na-tt" className="font-display text-xs font-bold text-[var(--dim)]">TikTok (opsional)</label>
            <input id="na-tt" {...FIELDS.adminCreateAffiliate.tiktok} value={form.tiktok} onChange={setF("tiktok")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="na-coupon" className="font-display text-xs font-bold text-[var(--dim)]">Kode kupon unik</label>
            <input id="na-coupon" {...FIELDS.adminCreateAffiliate.couponCode} value={form.couponCode} onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value.toUpperCase() }))} className={`${inputCls} uppercase`} />
          </div>
          <div>
            <label htmlFor="na-disc" className="font-display text-xs font-bold text-[var(--dim)]">Diskon standar (%)</label>
            <input id="na-disc" {...FIELDS.adminCreateAffiliate.discountPct} type="number" value={form.discountPct} onChange={setF("discountPct")} className={inputCls} />
          </div>
          <div>
            <label htmlFor="na-comm" className="font-display text-xs font-bold text-[var(--dim)]">Komisi afiliasi % (bawaan 30)</label>
            <input id="na-comm" {...FIELDS.adminCreateAffiliate.commissionPct} type="number" value={form.commissionPct} onChange={setF("commissionPct")} className={inputCls} />
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-bold text-berry" role="alert">{error}</p>}
        <button type="submit" disabled={create.isPending} className="mt-3 rounded-full bg-tang px-6 py-3 font-display text-base font-semibold text-ink disabled:opacity-50">
          {create.isPending ? "Membuat…" : "Buat Afiliasi & Tautan Undangan"}
        </button>
        {created && (
          <div className="mt-3 rounded-2xl bg-sage-soft px-4 py-3 ring-1 ring-[var(--border)]" role="status">
            <p className="font-display text-sm font-bold text-olive-deep">
              Afiliasi {created.name} dibuat. Bagikan potongan tautan aktivasi ini (berlaku {config.data?.inviteExpiryHours ?? 72} jam, sekali pakai):
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-xl bg-white px-3 py-1.5 text-xs font-bold ring-1 ring-[var(--border)]">{inviteLink(created.token)}</code>
              <CopyButton text={inviteLink(created.token)} label="Copy Invitation Link" />
            </p>
          </div>
        )}
      </form>
      </details>

      <div className="flex flex-wrap items-end gap-2 rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
        <div>
          <label htmlFor="cfg-min" className="font-display text-xs font-bold text-[var(--dim)]">Minimum penarikan (Rp)</label>
          <input id="cfg-min" {...FIELDS.updateAffiliateConfig.minWithdrawal} type="number" value={minWithdrawal} onChange={(e) => setMinWithdrawal(e.target.value)} className="mt-0.5 w-44 rounded-xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
        </div>
        <div>
          <label htmlFor="cfg-hours" className="font-display text-xs font-bold text-[var(--dim)]">Masa berlaku undangan (jam)</label>
          <input id="cfg-hours" {...FIELDS.updateAffiliateConfig.inviteExpiryHours} type="number" value={inviteHours} onChange={(e) => setInviteHours(e.target.value)} className="mt-0.5 w-32 rounded-xl bg-[var(--surface)] px-3 py-2 font-display text-sm font-bold ring-1 ring-[var(--border)]" />
        </div>
        <button type="button" disabled={saveConfig.isPending || !minWithdrawal || !inviteHours} onClick={() => saveConfig.mutate()} className="rounded-full bg-sky-deep px-5 py-2.5 font-display text-sm font-semibold text-white disabled:opacity-50">
          {saveConfig.isPending ? "Menyimpan…" : "Simpan Pengaturan Program"}
        </button>
        {saveConfig.isSuccess && <span className="pb-2 font-display text-sm font-bold text-olive-deep">Tersimpan ✓</span>}
      </div>

      <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]" aria-label="Manajemen akun affiliate">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold">Kelola Seluruh Affiliate</h3>
            <p className="text-sm font-semibold text-[var(--dim)]">Cari berdasarkan nama, HP, email, Instagram, TikTok, atau kode kupon. Atur status, komisi, diskon, dan KPI di tiap kartu.</p>
          </div>
          {affiliates.data && <p className="font-display text-sm font-bold text-olive-deep">{filtered.length} dari {rows.length} akun</p>}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="aff-admin-search" className="font-display text-xs font-bold text-[var(--dim)]">Cari akun</label>
            <input id="aff-admin-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama, nomor HP, kode, Instagram…" className={inputCls} />
          </div>
          <div>
            <label htmlFor="aff-admin-status" className="font-display text-xs font-bold text-[var(--dim)]">Filter status</label>
            <select id="aff-admin-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className={inputCls}>
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="pending">Belum Aktif (Akun Lama)</option>
              <option value="suspended">Ditangguhkan</option>
            </select>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {affiliates.isPending && !listUnavailable && <p className="font-display font-bold" role="status">Memuat afiliasi…</p>}
        {listUnavailable && (
          <div className="rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <p className="text-sm font-bold text-berry" role="alert">
              {affiliates.isPaused ? "Periksa koneksi internet untuk memuat daftar afiliasi." : affiliates.error?.message}
            </p>
            {affiliates.data && <p className="text-sm text-[var(--dim)]">Daftar di bawah berasal dari pemuatan terakhir.</p>}
            <button type="button" disabled={affiliates.isFetching} onClick={() => void affiliates.refetch()}
              className="mt-2 rounded-full bg-[var(--surface-alt)] px-4 py-2 text-sm font-bold ring-1 ring-[var(--border)]">
              Muat ulang daftar
            </button>
          </div>
        )}
        {!listUnavailable && affiliates.data?.affiliates.length === 0 && (
          <p className="font-semibold text-[var(--dim)]">Belum ada affiliate. Bagikan link pendaftaran umum agar mitra bisa mendaftar sendiri.</p>
        )}
        {filtered.length === 0 && rows.length > 0 && !affiliates.isPending && (
          <p className="rounded-2xl bg-[var(--surface)] p-4 text-sm font-semibold text-[var(--dim)]">Tidak ada affiliate yang cocok dengan pencarian/filter.</p>
        )}
        {filtered.map((a) => <AdminAffiliateCard key={a.id} a={a} />)}
      </div>

      <div className="rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
        <h3 className="font-display text-base font-semibold">Permintaan penarikan komisi</h3>
        {payouts.data?.payouts.length === 0 && <p className="mt-1 text-sm font-semibold text-[var(--dim)]">Belum ada permintaan penarikan.</p>}
        <ul className="mt-2 space-y-2">
          {payouts.data?.payouts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
              <span className="font-display text-sm font-bold">{p.affiliateName}</span>
              <span className="font-display text-sm">{formatIDR(p.amount)}</span>
              <span className="text-sm font-semibold text-[var(--dim)]">
                {p.bankName} · {p.accountName} · {p.accountNumber} · {new Date(p.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
              </span>
              <span className="rounded-full bg-[var(--surface-alt)] px-3 py-1 font-display text-xs font-bold">{PAYOUT_LABELS[p.status] ?? p.status}</span>
              <span className="ml-auto flex gap-1.5">
                {p.status === "requested" && (
                  <>
                    <button type="button" disabled={payoutAction.isPending} onClick={() => payoutAction.mutate({ id: p.id, decision: "approve" })} className="rounded-full bg-olive px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">Setujui</button>
                    <button type="button" disabled={payoutAction.isPending} onClick={() => payoutAction.mutate({ id: p.id, decision: "reject" })} className="rounded-full bg-berry px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">Tolak</button>
                  </>
                )}
                {p.status === "approved" && (
                  <button type="button" disabled={payoutAction.isPending} onClick={() => payoutAction.mutate({ id: p.id, decision: "paid" })} className="rounded-full bg-sky-deep px-4 py-2 font-display text-xs font-semibold text-white disabled:opacity-50">
                    Tandai Sudah Ditransfer
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {payoutAction.error && <p className="mt-2 text-sm font-bold text-berry" role="alert">{payoutAction.error.message}</p>}
      </div>

      <details className="rounded-3xl bg-[var(--bg)] p-4 ring-1 ring-[var(--border)]">
        <summary className="cursor-pointer font-display text-base font-semibold">Log audit afiliasi &amp; pembayaran</summary>
        <ul className="mt-2 space-y-1 text-sm font-semibold text-[var(--dim)]">
          {auditLog.data?.entries.map((e) => (
            <li key={e.id}>
              {new Date(e.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} · <span className="font-display text-ink">{e.action}</span> — {e.detail}
            </li>
          ))}
          {auditLog.data?.entries.length === 0 && <li>Belum ada catatan audit.</li>}
        </ul>
      </details>
    </div>
  );
}
