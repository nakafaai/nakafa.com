import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Struktur Atom",
    description:
      "Memahami blok bangunan fundamental alam semesta yang membentuk segala hal di sekitar kita.",
    href: `${BASE_PATH}/structure-matter`,
    items: [
      {
        title: "Konsep Atom Zaman Yunani",
        href: `${BASE_PATH}/structure-matter/ancient-atom-concept`,
      },
      {
        title: "Rekonseptualisasi Atom",
        href: `${BASE_PATH}/structure-matter/reconceptualization-atom`,
      },
      {
        title: "Partikel Subatom",
        href: `${BASE_PATH}/structure-matter/subatomic-particles`,
      },
      {
        title: "Sifat Partikel Subatom",
        href: `${BASE_PATH}/structure-matter/subatomic-particles-properties`,
      },
      {
        title: "Lambang Atom",
        href: `${BASE_PATH}/structure-matter/atom-symbol`,
      },
      {
        title: "Ion",
        href: `${BASE_PATH}/structure-matter/ion`,
      },
      {
        title: "Isotop",
        href: `${BASE_PATH}/structure-matter/isotope`,
      },
      {
        title: "Konfigurasi Elektron",
        href: `${BASE_PATH}/structure-matter/electron-configuration`,
      },
      {
        title: "Kulit Atom",
        href: `${BASE_PATH}/structure-matter/atom-shell`,
      },
      {
        title: "Elektron Valensi",
        href: `${BASE_PATH}/structure-matter/valence-electron`,
      },
      {
        title: "Sistem Periodik Unsur Modern",
        href: `${BASE_PATH}/structure-matter/modern-periodic-table`,
      },
      {
        title: "Sifat Keperiodikan Unsur",
        href: `${BASE_PATH}/structure-matter/periodic-properties`,
      },
    ],
  },
  {
    title: "Hukum Dasar Kimia",
    description:
      "Aturan emas yang mengatur semua reaksi kimia dari obat-obatan hingga bahan bakar roket.",
    href: `${BASE_PATH}/basic-chemistry-laws`,
    items: [
      {
        title: "Ciri-Ciri Reaksi Kimia",
        href: `${BASE_PATH}/basic-chemistry-laws/chemical-reaction-characteristics`,
      },
      {
        title: "Jenis Reaksi Kimia",
        href: `${BASE_PATH}/basic-chemistry-laws/types-chemical-reaction`,
      },
      {
        title: "Cara Menuliskan Reaksi Kimia",
        href: `${BASE_PATH}/basic-chemistry-laws/writing-chemical-reactions`,
      },
      {
        title: "Empat Hukum Dasar Kimia",
        href: `${BASE_PATH}/basic-chemistry-laws/four-basic-chemistry-laws`,
      },
      {
        title: "Aplikasi Hukum Dasar Kimia",
        href: `${BASE_PATH}/basic-chemistry-laws/application-basic-chemistry-laws`,
      },
      {
        title: "Hukum Perbandingan Tetap",
        href: `${BASE_PATH}/basic-chemistry-laws/law-constant-composition`,
      },
    ],
  },
  {
    title: "Kimia Hijau",
    description:
      "Revolusi ramah lingkungan dalam sains untuk melindungi planet sambil tetap berinovasi.",
    href: `${BASE_PATH}/green-chemistry`,
    items: [
      {
        title: "Pengertian Kimia Hijau",
        href: `${BASE_PATH}/green-chemistry/definition`,
      },
      {
        title: "Prinsip Kimia Hijau",
        href: `${BASE_PATH}/green-chemistry/principles`,
      },
      {
        title: "Proses Kimia dalam Kehidupan Sehari-Hari",
        href: `${BASE_PATH}/green-chemistry/chemical-processes-daily-life`,
      },
      {
        title: "Kegiatan Kimia Hijau",
        href: `${BASE_PATH}/green-chemistry/green-chemistry-activities`,
      },
    ],
  },
] as const;

export default idMaterials;
