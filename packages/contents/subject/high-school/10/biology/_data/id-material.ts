import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Virus dan Peranannya",
    description:
      "Organisme mikroskopis yang mengubah dunia dari penyakit hingga terapi gen masa depan.",
    href: `${BASE_PATH}/virus-role`,
    items: [
      {
        title: "Apa itu Virus?",
        href: `${BASE_PATH}/virus-role/what-is-virus`,
      },
      {
        title: "Bagaimana Virus Bereproduksi?",
        href: `${BASE_PATH}/virus-role/how-virus-reproduce`,
      },
      {
        title: "Peranan Virus",
        href: `${BASE_PATH}/virus-role/role`,
      },
      {
        title: "Cara Mencegah Penyebaran Virus",
        href: `${BASE_PATH}/virus-role/prevent-virus-spread`,
      },
    ],
  },
  {
    title: "Keanekaragaman Makhluk Hidup",
    description:
      "Keajaiban kehidupan di Bumi dari bakteri mikroskopis hingga hutan hujan tropis.",
    href: `${BASE_PATH}/biodiversity`,
    items: [
      {
        title: "Keanekaragaman Hayati",
        href: `${BASE_PATH}/biodiversity/levels`,
      },
      {
        title: "Klasifikasi Makhluk Hidup",
        href: `${BASE_PATH}/biodiversity/classification`,
      },
      {
        title: "Bakteri",
        href: `${BASE_PATH}/biodiversity/bacteria`,
      },
      {
        title: "Fungi",
        href: `${BASE_PATH}/biodiversity/fungi`,
      },
      {
        title: "Makhluk Hidup dalam Ekosistem",
        href: `${BASE_PATH}/biodiversity/living-organisms`,
      },
    ],
  },
  {
    title: "Perubahan Iklim",
    description:
      "Tantangan global terbesar yang mempengaruhi masa depan planet dan kehidupan kita.",
    href: `${BASE_PATH}/climate-change`,
    items: [
      {
        title: "Gejala Perubahan Iklim",
        href: `${BASE_PATH}/climate-change/symptoms`,
      },
      {
        title: "Dampak Perubahan Iklim",
        href: `${BASE_PATH}/climate-change/impact`,
      },
      {
        title: "Penyebab Perubahan Iklim",
        href: `${BASE_PATH}/climate-change/causes`,
      },
      {
        title: "Upaya Mitigasi dan Adaptasi terhadap Perubahan Iklim",
        href: `${BASE_PATH}/climate-change/mitigation-adaptation`,
      },
      {
        title: "Kerja Sama Global untuk Mengatasi Perubahan Iklim",
        href: `${BASE_PATH}/climate-change/global-cooperation`,
      },
    ],
  },
] as const;

export default idMaterials;
