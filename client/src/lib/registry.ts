import { monochromeDetails, type RegionDef, type TemplateDef } from "./model";
import { PREMIUM_TEMPLATES } from "./premium";
import { KOLEKSI_TEMPLATES, KOLEKSI_EASY_MERGES } from "./koleksi";

export interface Collection {
  id: string;
  name: string;
  tagline: string;
  color: string;
  soft: string;
}

export const COLLECTIONS: Collection[] = [
  { id: "dino-world", name: "Dunia Dino", tagline: "Raksasa lembut dari zaman dulu", color: "#2F9E44", soft: "#DFF3D8" },
  { id: "animal-friends", name: "Teman Hewan", tagline: "Berbulu, lucu, dan ramah", color: "#F2762E", soft: "#FFE8D6" },
  { id: "little-vehicles", name: "Kendaraan Kecil", tagline: "Tit tit, wus, dan brum", color: "#1E88C7", soft: "#D6F0FD" },
  { id: "space-explorers", name: "Penjelajah Antariksa", tagline: "Sampai ke bulan dan kembali", color: "#7B4BA8", soft: "#F0E4FB" },
  { id: "magical-garden", name: "Taman Ajaib", tagline: "Tempat keajaiban kecil tumbuh", color: "#E84393", soft: "#FFE0EF" },
  { id: "little-homes", name: "Rumah-rumah Kecil", tagline: "Tempat nyaman untuk pulang", color: "#D97706", soft: "#FDEFD2" },
];

export interface AgeBand {
  id: string;
  label: string;
  hint: string;
  /** Bright accent for chips and cards of this age band. */
  color: string;
  soft: string;
}

/** Kategori umur 9 bulan – 5 tahun; band termuda = gambar paling sederhana. */
export const AGE_BANDS: AgeBand[] = [
  { id: "9-18bln", label: "9–18 bulan", hint: "Gambar super besar, sedikit bagian, garis tebal", color: "#E84393", soft: "#FFE0EF" },
  { id: "1-2th", label: "18–24 bulan", hint: "Tetap besar-besar, sedikit lebih seru", color: "#F2762E", soft: "#FFE8D6" },
  { id: "2-3th", label: "2–3 tahun", hint: "Lebih banyak bagian untuk diwarnai", color: "#E8A100", soft: "#FFF3D1" },
  { id: "3-4th", label: "3–4 tahun", hint: "Detail makin seru dan menantang", color: "#2F9E44", soft: "#DFF3D8" },
  { id: "4-5th", label: "4–5 tahun", hint: "Paling detail, untuk anak besar", color: "#1E88C7", soft: "#D6F0FD" },
];

export function ageBandOf(id: string): AgeBand {
  return AGE_BANDS.find((b) => b.id === id) ?? AGE_BANDS[2]!;
}

/* ------------------------- Tingkat kesulitan ------------------------- */

export interface DifficultyTier {
  id: string;
  label: string;
  hint: string;
  color: string;
  soft: string;
}

/**
 * Tingkat kesulitan mewarnai, diturunkan dari jumlah region/detail gambar
 * dan dilunakkan untuk band umur termuda (bidang mereka memang besar-besar).
 */
export const DIFFICULTY_TIERS: DifficultyTier[] = [
  { id: "sangat-mudah", label: "Sangat Mudah", hint: "3–5 bidang besar, garis tebal", color: "#2F9E44", soft: "#DFF3D8" },
  { id: "mudah", label: "Mudah", hint: "Bidang besar dengan sedikit detail", color: "#1E88C7", soft: "#D6F0FD" },
  { id: "sedang", label: "Sedang", hint: "Lebih banyak bagian seru untuk diwarnai", color: "#D97706", soft: "#FDEFD2" },
  { id: "menantang", label: "Menantang", hint: "Paling banyak detail — untuk anak besar", color: "#E4572E", soft: "#FFE3D6" },
  { id: "pemula", label: "Pemula", hint: "Level 2 · 18–24 bulan — bidang besar yang mudah dibedakan", color: "#F2762E", soft: "#FFE8D6" },
  { id: "kreatif", label: "Kreatif", hint: "Level 5 · 4–5 tahun — adegan penuh cerita", color: "#7B4BA8", soft: "#F0E4FB" },
];

/** Tingkat kesulitan resmi per level umur, persis sistem brief:
 * L1 Sangat Mudah, L2 Pemula, L3 Mudah, L4 Sedang, L5 Kreatif.
 * Seluruh katalog mengikuti sistem level ini. */
const LEVEL_TIER: Record<string, string> = {
  "9-18bln": "sangat-mudah",
  "1-2th": "pemula",
  "2-3th": "mudah",
  "3-4th": "sedang",
  "4-5th": "kreatif",
};

export function difficultyTierOf(t: TemplateDef): DifficultyTier {
  const tier = DIFFICULTY_TIERS.find((d) => d.id === LEVEL_TIER[t.ageBand]);
  if (tier) return tier;
  const n = t.regions.length;
  let idx = n <= 3 ? 0 : n <= 5 ? 1 : n <= 7 ? 2 : 3;
  if (t.ageBand === "9-18bln") idx = Math.max(0, idx - 1);
  return DIFFICULTY_TIERS[idx]!;
}

/* --------------------------- Mode Mudah ------------------------------ */

/**
 * Region detail kecil → region induknya. Di Mode Mudah, region detail
 * digabung ke induknya (satu bidang ketuk besar, satu warna), sedangkan
 * Mode Lengkap menampilkan semua region apa adanya. Hanya karakter yang
 * detailnya bisa digabung dengan aman yang punya peta ini; karakter lain
 * tidak menampilkan pilihan mode sama sekali.
 */
export const EASY_MERGES: Record<string, Record<string, string>> = {
  // Detail terkecil digabung ke bidang induknya.
  "pb-beruang": { belly: "body" },
  "pb-gajah": { trunk: "body" },
  "pb-bebek-kolam": { wing: "body", beak: "head" },
  "pb-kura": { pattern: "shell" },
  "pb-mobil-kecil": { lights: "body" },
  "pb-kupu": { spots: "wings" },
  "pb-dino": { belly: "body", spikes: "body" },
  "pb-singa-kecil": { muzzle: "face", ears: "mane" },
  "pb-roket-ramah": { stripe: "body", nose: "body" },
  "pb-anjing": { spots: "body", collar: "body" },
  "pb-dino-taman": { belly: "body", spikes: "body", leaves: "trunk" },
  "pb-kelinci-taman": { belly: "body", carrotTop: "carrot" },
  "pb-pemadam": { door: "body", stripe: "body", light: "cabin" },
  "pb-astronot": { gloves: "suit", boots: "suit" },
  "pb-dunia-dino": { belly: "body", spikes: "body", lava: "volcano", egg: "ground" },
  "pb-laut": { fishFin: "fishBody", bubbles: "waves", snail: "sand" },
  "pb-antariksa": { rocketStripe: "rocketBody", spots: "planet", astroVisor: "astroHelmet" },
  "pb-desa": { chimney: "roof1", windows: "walls1", fence: "grass" },
  ...KOLEKSI_EASY_MERGES,
};

const simpleCache = new Map<string, TemplateDef | null>();

/**
 * Versi Mode Mudah dari sebuah template: region detail dilebur ke region
 * induknya (els-nya ikut pindah, jadi bidang ketuknya benar-benar lebih
 * besar), dan fallback warna ditambah supaya hasil print tetap konsisten.
 * Mengembalikan null bila karakter ini tidak mendukung Mode Mudah.
 */
export function simplifyTemplate(t: TemplateDef): TemplateDef | null {
  const cached = simpleCache.get(t.id);
  if (cached !== undefined) return cached;
  const merge = EASY_MERGES[t.id];
  let out: TemplateDef | null = null;
  if (merge) {
    // Two passes: a detail region may be drawn before its parent, so first
    // register every surviving region, then fold the merged ones into it.
    const byId = new Map<string, RegionDef>();
    for (const r of t.regions) {
      if (!merge[r.id]) byId.set(r.id, { ...r, els: [...r.els] });
    }
    for (const r of t.regions) {
      const parent = merge[r.id];
      if (parent) {
        const p = byId.get(parent);
        if (p) p.els = [...p.els, ...r.els];
      }
    }
    out = {
      ...t,
      regions: [...byId.values()],
      regionFallbacks: { ...t.regionFallbacks, ...merge },
    };
  }
  simpleCache.set(t.id, out);
  return out;
}

/**
 * Katalog lengkap: tepat 200 ilustrasi bergaya buku cerita yang konsisten
 * — 20 ilustrasi gambar-tangan (premium.ts) + 180 ilustrasi baru
 * (koleksi.ts) — 40 per kategori umur. Setiap ilustrasi punya region
 * mewarnai SVG tertutup, model bantal 3D, dan cetakan yang berfungsi
 * penuh dari data region yang sama.
 */
// Semua koleksi tampil hitam putih: detail bawaan setiap template diubah
// ke hitam/putih/abu, dan bidang region mulai putih kosong (UNCOLORED).
// Warna hanya datang dari hasil warnai anak sendiri.
export const TEMPLATES: TemplateDef[] = [...PREMIUM_TEMPLATES, ...KOLEKSI_TEMPLATES].map(
  (t) => ({ ...t, details: monochromeDetails(t.details) }),
);

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
}

export function collectionOf(id: string): Collection {
  return COLLECTIONS.find((c) => c.id === id) ?? COLLECTIONS[0]!;
}

/**
 * Skema warna contoh lama. TIDAK lagi ditampilkan di mana pun: semua
 * thumbnail dan demo kini hitam putih (bidang kosong) sesuai permintaan
 * agar anak mulai dari halaman kosong. Disimpan hanya sebagai referensi
 * palet; jangan pakai untuk mewarnai pratinjau koleksi.
 */
export const DEMO_COLORS: Record<string, Record<string, string>> = {
  "pb-dino": { tail: "#8AC926", body: "#3FA34D", feet: "#EF6FA5", spikes: "#8A5A33", head: "#3E92CC", belly: "#3E92CC" },
};
