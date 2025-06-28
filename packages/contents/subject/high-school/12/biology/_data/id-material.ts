import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Enzim dan Metabolisme",
    description:
      "Katalis biologis yang menggerakkan semua reaksi kehidupan dari pencernaan hingga respirasi.",
    href: `${BASE_PATH}/enzyme-metabolism`,
    items: [
      {
        title: "Enzim",
        href: `${BASE_PATH}/enzyme-metabolism/enzyme`,
      },
      {
        title: "Metabolisme",
        href: `${BASE_PATH}/enzyme-metabolism/metabolism`,
      },
    ],
  },
  {
    title: "Genetik dan Pewarisan Sifat",
    description:
      "Kode kehidupan yang menentukan warna mata, tinggi badan, dan semua sifat turunan.",
    href: `${BASE_PATH}/genetic-inheritance`,
    items: [
      {
        title: "Materi Genetik",
        href: `${BASE_PATH}/genetic-inheritance/genetic-material`,
      },
      {
        title: "Sintesis Protein",
        href: `${BASE_PATH}/genetic-inheritance/protein-synthesis`,
      },
      {
        title: "Pembelahan Sel",
        href: `${BASE_PATH}/genetic-inheritance/cell-division`,
      },
      {
        title: "Pewarisan Sifat",
        href: `${BASE_PATH}/genetic-inheritance/inheritance`,
      },
    ],
  },
  {
    title: "Evolusi",
    description:
      "Perjalanan spektakuler kehidupan dari organisme sederhana hingga keanekaragaman modern.",
    href: `${BASE_PATH}/evolution`,
    items: [
      {
        title: "Definisi Evolusi",
        href: `${BASE_PATH}/evolution/definition`,
      },
      {
        title: "Perkembangan Teori Evolusi",
        href: `${BASE_PATH}/evolution/development-theory`,
      },
    ],
  },
  {
    title: "Inovasi Bioteknologi",
    description:
      "Revolusi sains yang menghasilkan obat-obatan, vaksin, dan solusi masa depan.",
    href: `${BASE_PATH}/biotechnology-innovation`,
    items: [
      {
        title: "Definisi Bioteknologi",
        href: `${BASE_PATH}/biotechnology-innovation/definition`,
      },
      {
        title: "Manfaat Bioteknologi",
        href: `${BASE_PATH}/biotechnology-innovation/benefit`,
      },
      {
        title: "Jenis Bioteknologi",
        href: `${BASE_PATH}/biotechnology-innovation/type`,
      },
      {
        title: "Cabang Ilmu yang Berperan dalam Bioteknologi",
        href: `${BASE_PATH}/biotechnology-innovation/branch`,
      },
      {
        title: "Aplikasi Bioteknologi Konvensional",
        href: `${BASE_PATH}/biotechnology-innovation/conventional-application`,
      },
      {
        title: "Aplikasi Bioteknologi Modern",
        href: `${BASE_PATH}/biotechnology-innovation/modern-application`,
      },
      {
        title: "Harapan dan Kenyataan Bioteknologi Modern",
        href: `${BASE_PATH}/biotechnology-innovation/modern-reality`,
      },
      {
        title: "Bioetika",
        href: `${BASE_PATH}/biotechnology-innovation/bioethics`,
      },
    ],
  },
] as const;

export default idMaterials;
