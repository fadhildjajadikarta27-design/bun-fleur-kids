export type ProductId = "poster" | "papercraft" | "figurine" | "tshirt" | "celengan" | "accessory59" | "puzzle" | "placemat" | "growthchart";

// Retired SKUs remain in ProductId and metadata for historical orders.
export const ACTIVE_PRODUCT_IDS: readonly ProductId[] = ["poster", "papercraft", "placemat", "celengan", "puzzle", "growthchart", "tshirt"];
export const PRODUCT_DEFAULT_PRICES: Record<ProductId, number> = {
  poster: 24900, papercraft: 36900, placemat: 54900, celengan: 59900, puzzle: 69000, growthchart: 69000, tshirt: 79000, figurine: 120000, accessory59: 59000,
};

export function formatIDR(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export const PRODUCT_META: Record<
  ProductId,
  { title: string; tagline: string; description: string; cta: string; see: string }
> = {
  poster: {
    title: "Poster",
    tagline: "Poster Personalisasi",
    description: "Abadikan karya mewarnai si kecil dalam poster personalisasi. Karakter, warna, coretan, dan namanya menjadi hiasan kamar yang istimewa.",
    cta: "Buat Poster-ku",
    see: "Lihat Desain Poster",
  },
  puzzle: {
    title: "Puzzle",
    tagline: "Puzzle",
    description: "Susun kembali gambar yang si kecil warnai, lengkap dengan nama pilihannya.",
    cta: "Buat Puzzle",
    see: "Lihat Desain Puzzle",
  },
  placemat: {
    title: "Alas Makan",
    tagline: "Alas Makan Personalisasi",
    description: "Hadirkan karya si kecil di meja makan, dengan warna dan nama pilihannya.",
    cta: "Buat Alas Makan",
    see: "Lihat Desain Alas Makan",
  },
  growthchart: {
    title: "Pengukur Tinggi Badan (Growth Chart)",
    tagline: "Pengukur Tinggi Badan",
    description: "Pengukur tinggi badan tempel yang menampilkan karakter, warna, dan nama dari karya si kecil.",
    cta: "Buat Pengukur Tinggi Badan",
    see: "Lihat Desain Pengukur Tinggi Badan",
  },
  accessory59: {
    title: "Aksesori Custom Premium",
    tagline: "Aksesori",
    description: "Aksesori personal dari hasil mewarnai si kecil — karakter, pilihan warna, serta namanya menjadi desain produk miliknya sendiri.",
    cta: "Buat Aksesori-ku",
    see: "Lihat Desain-ku",
  },
  celengan: {
    title: "Celengan",
    tagline: "Aksesori Celengan",
    description: "Celengan tabung bergambar karya si kecil, lengkap dengan warna dan namanya. Kenang-kenangan pribadi yang bisa digunakan sehari-hari.",
    cta: "Buat Celengan-ku",
    see: "Lihat Celengan-ku",
  },
  papercraft: {
    title: "Papercraft 3D",
    tagline: "Papercraft 3D",
    description: "Karya si kecil berubah jadi kit kertas 3D siap gunting, lipat, dan lem — warnanya persis, namanya juga!",
    cta: "Buat Papercraft-ku",
    see: "Lihat Papercraft-ku",
  },
  figurine: {
    title: "Custom 3D Figurine",
    tagline: "Figurine 3D Custom",
    description: "Kenang-kenangan berbentuk figur tiga dimensi dari karya anak (produk lama).",
    cta: "Buat Figur 3D",
    see: "Lihat Figur 3D",
  },
  tshirt: {
    title: "Kaos",
    tagline: "Kaos Personalisasi",
    description: "Kenakan karya si kecil pada kaos pilihannya. Gambar dan warna asli anak tercetak di depan, dengan logo kecil Bun & Fleur Kids di belakang. Nama anak dapat ditambahkan.",
    cta: "Buat Kaos-ku",
    see: "Lihat Desain Kaos",
  },
};
