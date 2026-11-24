// Shared allowlist for client previews and server order snapshots.
export const BACKGROUNDS = [
  {
    "id": "01_Langit_Cerah",
    "label": "Langit Cerah"
  },
  {
    "id": "02_Taman",
    "label": "Taman"
  },
  {
    "id": "03_Pelangi",
    "label": "Pelangi"
  },
  {
    "id": "04_Awan_Lucu",
    "label": "Awan Lucu"
  },
  {
    "id": "05_Luar_Angkasa",
    "label": "Luar Angkasa"
  },
  {
    "id": "06_Laut",
    "label": "Laut"
  },
  {
    "id": "07_Gunung",
    "label": "Gunung"
  },
  {
    "id": "08_Ulang_Tahun",
    "label": "Ulang Tahun"
  },
  {
    "id": "09_Sekolah",
    "label": "Sekolah"
  }
] as const;
export function isBackgroundId(id: string): boolean { return id === "" || BACKGROUNDS.some(b => b.id === id); }
export function backgroundUrl(id?: string): string | undefined { return id && isBackgroundId(id) ? "/backgrounds/" + id + ".png" : undefined; }
