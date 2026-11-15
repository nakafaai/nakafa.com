import type { SearchEntry } from "@/lib/search/entry";

/**
 * A small Indonesian index that the search tests rank against: one entry of
 * every kind, in the build's order, the way the static build writes them.
 */
export const INDONESIAN_ENTRIES: readonly SearchEntry[] = [
  { kind: "hub", path: "/id/kurikulum", title: "Kurikulum sekolah", trail: [] },
  {
    flag: "ID",
    kind: "curriculum",
    path: "/id/kurikulum/merdeka",
    title: "Kurikulum Merdeka",
    trail: [],
  },
  {
    flag: "MY",
    kind: "curriculum",
    path: "/id/kurikulum/kssm",
    title: "KSSM",
    trail: [],
  },
  {
    kind: "level",
    path: "/id/kurikulum/merdeka/kelas-10",
    title: "Kelas 10",
    trail: ["Kurikulum Merdeka"],
  },
  {
    kind: "level",
    path: "/id/kurikulum/merdeka/kelas-11",
    title: "Kelas 11",
    trail: ["Kurikulum Merdeka"],
  },
  {
    kind: "subject",
    path: "/id/kurikulum/merdeka/kelas-10/kimia",
    title: "Kimia",
    trail: ["Kurikulum Merdeka", "Kelas 10"],
  },
  {
    kind: "subject",
    path: "/id/kurikulum/merdeka/kelas-10/matematika",
    title: "Matematika",
    trail: ["Kurikulum Merdeka", "Kelas 10"],
  },
  {
    kind: "subject",
    path: "/id/kurikulum/merdeka/kelas-11/fisika",
    title: "Fisika",
    trail: ["Kurikulum Merdeka", "Kelas 11"],
  },
  {
    kind: "lesson",
    path: "/id/materi/kimia/struktur-atom/teori-dalton",
    terms: ["Cambridge International"],
    title: "Teori Atom Dalton",
    trail: ["Kurikulum Merdeka", "Kelas 10", "Kimia"],
  },
  {
    kind: "lesson",
    path: "/id/materi/matematika/fungsi/komposisi",
    title: "Komposisi Fungsi",
    trail: ["Kurikulum Merdeka", "Kelas 10", "Matematika"],
  },
  { kind: "hub", path: "/id/try-out", title: "Try out", trail: [] },
  {
    flag: "ID",
    kind: "country",
    path: "/id/try-out/indonesia",
    title: "Indonesia",
    trail: [],
  },
  {
    kind: "exam",
    path: "/id/try-out/indonesia/snbt",
    title: "SNBT",
    trail: ["Indonesia"],
  },
  {
    kind: "exam",
    path: "/id/try-out/indonesia/tka",
    title: "TKA",
    trail: ["Indonesia"],
  },
  {
    kind: "tryout",
    path: "/id/try-out/indonesia/snbt/2027/set-1",
    title: "Set 1",
    trail: ["Indonesia", "SNBT", "Tahun 2027"],
  },
  {
    kind: "surah",
    path: "/id/quran/2",
    terms: ["Sapi Betina", "2"],
    title: "Al-Baqarah",
    trail: [],
  },
  {
    kind: "category",
    path: "/id/articles/politik",
    title: "Politik",
    trail: [],
  },
  {
    kind: "article",
    path: "/id/articles/politik/kabinet",
    title: "Kabinet Merah Putih",
    trail: ["Politik"],
  },
  { kind: "page", path: "/id/pricing", title: "Harga", trail: [] },
];
