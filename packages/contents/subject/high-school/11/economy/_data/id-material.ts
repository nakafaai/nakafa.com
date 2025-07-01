import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Badan Usaha dalam Perekonomian",
    description:
      "Organisasi berkuasa yang mendorong pertumbuhan ekonomi dan menciptakan lapangan kerja.",
    href: `${BASE_PATH}/business-economy`,
    items: [
      {
        title: "Konsep Badan Usaha",
        href: `${BASE_PATH}/business-economy/concept-enterprise`,
      },
      {
        title: "Badan Usaha Milik Negara",
        href: `${BASE_PATH}/business-economy/state-owned-enterprise`,
      },
      {
        title: "Badan Usaha Milik Daerah",
        href: `${BASE_PATH}/business-economy/local-government-enterprise`,
      },
      {
        title: "Badan Usaha Milik Swasta",
        href: `${BASE_PATH}/business-economy/private-enterprise`,
      },
      {
        title: "Koperasi",
        href: `${BASE_PATH}/business-economy/cooperative`,
      },
      {
        title: "Manajemen",
        href: `${BASE_PATH}/business-economy/management`,
      },
    ],
  },
  {
    title: "Pendapatan Nasional dan Kesenjangan Ekonomi",
    description:
      "Mengukur kekayaan bangsa dan memahami mengapa ada yang makmur dan ada yang miskin.",
    href: `${BASE_PATH}/national-income-inequality`,
    items: [
      {
        title: "Pendapatan Nasional",
        href: `${BASE_PATH}/national-income-inequality/national-income`,
      },
      {
        title: "Kesenjangan Ekonomi",
        href: `${BASE_PATH}/national-income-inequality/economic-inequality`,
      },
    ],
  },
  {
    title: "Ketenagakerjaan",
    description:
      "Jembatan vital yang menghubungkan manusia dengan pendapatan dan stabilitas ekonomi.",
    href: `${BASE_PATH}/employment`,
    items: [
      {
        title: "Konsep Ketenagakerjaan",
        href: `${BASE_PATH}/employment/concept`,
      },
      {
        title: "Sistem Upah",
        href: `${BASE_PATH}/employment/wage-system`,
      },
      {
        title: "Pengangguran",
        href: `${BASE_PATH}/employment/unemployment`,
      },
    ],
  },
  {
    title: "Teori Uang, Indeks Harga dan Inflasi",
    description:
      "Kekuatan yang menentukan daya beli uang Anda hari ini versus besok.",
    href: `${BASE_PATH}/money-price-inflation`,
    items: [
      {
        title: "Permintaan dan Penawaran Uang",
        href: `${BASE_PATH}/money-price-inflation/demand-supply-money`,
      },
      {
        title: "Indeks Harga",
        href: `${BASE_PATH}/money-price-inflation/price-index`,
      },
      {
        title: "Inflasi",
        href: `${BASE_PATH}/money-price-inflation/inflation`,
      },
    ],
  },
  {
    title: "Kebijakan Moneter dan Kebijakan Fiskal",
    description:
      "Toolkit ekonomi pemerintah untuk mengarahkan bangsa melalui kemakmuran dan krisis.",
    href: `${BASE_PATH}/monetary-fiscal-policy`,
    items: [
      {
        title: "Kebijakan Moneter",
        href: `${BASE_PATH}/monetary-fiscal-policy/monetary-policy`,
      },
      {
        title: "Kebijakan Fiskal",
        href: `${BASE_PATH}/monetary-fiscal-policy/fiscal-policy`,
      },
      {
        title: "Manfaat dan Dampak Kebijakan Ekonomi",
        href: `${BASE_PATH}/monetary-fiscal-policy/benefits-impacts`,
      },
      {
        title: "Evaluasi Kebijakan Ekonomi",
        href: `${BASE_PATH}/monetary-fiscal-policy/evaluation`,
      },
    ],
  },
] as const;

export default idMaterials;
