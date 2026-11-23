import { useEffect, useState, type ReactNode } from "react";

async function adminAction(action: string, args: Record<string, unknown> = {}) {
  const response = await fetch("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, args }),
  });
  const body = await response.json() as { authenticated?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || "Server admin belum tersedia.");
  return body;
}

/** Server-verified admin boundary; hiding a URL is never authentication. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void adminAction("adminStatus")
      .then((data) => { if (alive) setAuthorized(data.authenticated === true); })
      .catch(() => { if (alive) setError("Backend belum tersedia. Coba lagi setelah server pulih."); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  if (checking) return <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center text-olive">Memeriksa akses admin...</div>;
  if (authorized) {
    return <div>
      <div className="mx-auto mb-4 flex max-w-4xl justify-end px-4">
        <button type="button" onClick={() => {
          void adminAction("adminLogout").then(() => { setAuthorized(false); setPassword(""); })
            .catch(() => setError("Tidak bisa keluar. Muat ulang halaman."));
        }} className="rounded-full border border-olive/30 px-4 py-2 font-display text-sm font-semibold text-olive">
          Keluar dari Admin
        </button>
      </div>
      {children}
    </div>;
  }
  return (
    <section className="mx-auto my-6 max-w-lg rounded-3xl bg-white p-6 shadow-sm ring-1 ring-olive/15 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-olive">Masuk Admin Bun & Fleur Kids</h2>
      <p className="mt-2 text-sm text-[var(--dim)]">Halaman pesanan, konfigurasi, dan afiliasi hanya untuk pengelola. Masukkan password admin yang tersimpan di server.</p>
      <form className="mt-5 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (busy || !password) return;
        setBusy(true); setError("");
        void adminAction("adminLogin", { password })
          .then(() => { setAuthorized(true); setPassword(""); })
          .catch((err: Error) => setError(err.message))
          .finally(() => setBusy(false));
      }}>
        <label htmlFor="bf-admin-password" className="block text-sm font-semibold">Password admin</label>
        <input id="bf-admin-password" autoComplete="current-password" type="password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          required className="w-full rounded-xl border border-olive/25 bg-[#F8F4EC] p-3 focus:outline-2 focus:outline-sky" />
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !password}
          className="w-full rounded-full bg-olive px-5 py-3 font-display font-bold text-white disabled:opacity-50">
          {busy ? "Memeriksa..." : "Masuk Admin"}
        </button>
      </form>
    </section>
  );
}
