import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title:
      "Pengembangan Wilayah, Tata Ruang, dan Pengaruhnya terhadap Kebahagiaan",
    description:
      "Seni membangun ruang yang mengubah wilayah menjadi tempat bahagia untuk hidup.",
    href: `${BASE_PATH}/development-happiness`,
    items: [
      {
        title: "Pengembangan Wilayah",
        href: `${BASE_PATH}/development-happiness/region-development`,
      },
      {
        title: "Pengembangan Desa",
        href: `${BASE_PATH}/development-happiness/village-development`,
      },
      {
        title: "Pengembangan Kota",
        href: `${BASE_PATH}/development-happiness/city-development`,
      },
      {
        title: "Tata Ruang Pembagungan Wilayah",
        href: `${BASE_PATH}/development-happiness/region-spatial-development`,
      },
      {
        title: "Dinamika Pembangunan Wilayah",
        href: `${BASE_PATH}/development-happiness/region-development-dynamics`,
      },
      {
        title: "Indeks Kebahagiaan sebagai Hasil Pembangunan Wilayah",
        href: `${BASE_PATH}/development-happiness/happiness-index`,
      },
      {
        title:
          "Pengaruh Pembangunan Wilayah dan Tata Ruang terhadap Kebahagiaan Penduduk",
        href: `${BASE_PATH}/development-happiness/region-spatial-happiness-impact`,
      },
    ],
  },
  {
    title:
      "Pembangunan Wilayah, Revolusi Industri, dan Pengaruhnya terhadap Ruang Muka Bumi dan Kesejahteraan",
    description:
      "Transformasi digital yang mengubah wajah bumi dan membentuk masa depan kemakmuran.",
    href: `${BASE_PATH}/region-industry-wellbeing`,
    items: [
      {
        title: "Pengertian Pembangunan",
        href: `${BASE_PATH}/region-industry-wellbeing/development-definition`,
      },
      {
        title: "Paradigma Pembangunan",
        href: `${BASE_PATH}/region-industry-wellbeing/development-paradigm`,
      },
      {
        title: "Pendekatan Pembangunan",
        href: `${BASE_PATH}/region-industry-wellbeing/development-approach`,
      },
      {
        title: "Indikator Pembangunan",
        href: `${BASE_PATH}/region-industry-wellbeing/development-indicator`,
      },
      {
        title: "Revolusi Industri 4.0",
        href: `${BASE_PATH}/region-industry-wellbeing/industry-revolution-4`,
      },
      {
        title: "Masyarakat 5.0",
        href: `${BASE_PATH}/region-industry-wellbeing/society-5`,
      },
      {
        title: "Kesejahteraan Penduduk sebagai Hasil Pembangunan",
        href: `${BASE_PATH}/region-industry-wellbeing/wellbeing-result`,
      },
      {
        title:
          "Pengaruh Pembagunan Wilayah dan Revolusi Industri terhadap Kesejahteraan",
        href: `${BASE_PATH}/region-industry-wellbeing/impact`,
      },
    ],
  },
  {
    title:
      "Dinamika Kerja Sama Antarnegara dan Pengaruhnya terhadap Ketahanan Wilayah Indonesia",
    description:
      "Jalinan diplomasi global yang memperkuat benteng pertahanan Indonesia.",
    href: `${BASE_PATH}/international-cooperation-security`,
    items: [
      {
        title: "Kerja Sama Antar Negara",
        href: `${BASE_PATH}/international-cooperation-security/international-cooperation`,
      },
      {
        title:
          "Geopolitik Indonesia sebagai Potensi Menjalin Kerja Sama Internasional",
        href: `${BASE_PATH}/international-cooperation-security/indonesia-geopolitics`,
      },
      {
        title: "Kerja Sama Indonesia dalam Kancah Internasional",
        href: `${BASE_PATH}/international-cooperation-security/indonesia-international-cooperation`,
      },
      {
        title: "Pengaruh Kerja Sama Antar Negara terhadap Ketahanan Wilayah",
        href: `${BASE_PATH}/international-cooperation-security/impact`,
      },
    ],
  },
] as const;

export default idMaterials;
