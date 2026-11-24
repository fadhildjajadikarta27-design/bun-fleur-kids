export type ProductId = "poster" | "papercraft" | "figurine" | "tshirt" | "celengan" | "accessory59" | "puzzle" | "placemat";

export function formatIDR(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export const PRODUCT_META: Record<
  ProductId,
  { title: string; tagline: string; description: string; cta: string; see: string }
> = {
  poster: {
    title: "Printed Poster",
    tagline: "Poster Berbingkai",
    description: "Turn their artwork into a beautiful keepsake for their room.",
    cta: "Create My Poster",
    see: "See My Poster",
  },
  puzzle: {
    title: "Puzzle Personalisasi",
    tagline: "Puzzle",
    description: "Susun kembali gambar yang si kecil warnai, lengkap dengan nama pilihannya.",
    cta: "Buat Puzzle",
    see: "Lihat Desain Puzzle",
  },
  placemat: {
    title: "Alas Makan Personalisasi",
    tagline: "Personalized Placemat",
    description: "Hadirkan karya si kecil di meja makan, dengan warna dan nama pilihannya.",
    cta: "Buat Alas Makan",
    see: "Lihat Desain Alas Makan",
  },
  accessory59: {
    title: "Aksesori Custom Premium",
    tagline: "Accessories",
    description: "Aksesori personal dari hasil mewarnai si kecil — karakter, pilihan warna, serta namanya menjadi desain produk miliknya sendiri.",
    cta: "Buat Aksesori-ku",
    see: "Lihat Desain-ku",
  },
  celengan: {
    title: "Celengan Custom",
    tagline: "Aksesori Celengan",
    description: "Celengan tabung bergambar karya si kecil, lengkap dengan warna dan namanya. Souvenir personal yang bisa digunakan sehari-hari.",
    cta: "Buat Celengan-ku",
    see: "Lihat Celengan-ku",
  },
  papercraft: {
    title: "3D Papercraft Custom",
    tagline: "Papercraft 3D",
    description: "Karya si kecil berubah jadi kit kertas 3D siap gunting, lipat, dan lem — warnanya persis, namanya juga!",
    cta: "Buat Papercraft-ku",
    see: "Lihat Papercraft-ku",
  },
  figurine: {
    title: "Custom 3D Figurine",
    tagline: "Figurine 3D Custom",
    description: "Watch their imagination come to life in 3D.",
    cta: "Create My Figurine",
    see: "See My 3D Figurine",
  },
  tshirt: {
    title: "Custom Printed T-Shirt",
    tagline: "Kaos Custom",
    description: "Wear your imagination, made just for you.",
    cta: "Create My T-Shirt",
    see: "See My T-Shirt",
  },
};
