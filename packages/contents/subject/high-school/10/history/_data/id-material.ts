import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Pengantar Ilmu Sejarah",
    description:
      "Perjalanan waktu yang mengungkap rahasia masa lalu untuk memahami masa kini.",
    href: `${BASE_PATH}/history-introduction`,
    items: [
      {
        title: "Konsep Sejarah",
        href: `${BASE_PATH}/history-introduction/concept`,
      },
      {
        title: "Mengapa Perlu Mempelajari Ilmu Sejarah?",
        href: `${BASE_PATH}/history-introduction/why-study-history`,
      },
      {
        title: "Manusia, Ruang, dan Waktu dalam Sejarah",
        href: `${BASE_PATH}/history-introduction/human-space-time`,
      },
    ],
  },
  {
    title: "Penelitian Sejarah",
    description:
      "Seni detektif masa lalu yang mencari kebenaran dari jejak-jejak yang tertinggal.",
    href: `${BASE_PATH}/history-research`,
    items: [
      {
        title: "Sumber Sejarah Primer",
        href: `${BASE_PATH}/history-research/primary-sources`,
      },
      {
        title: "Sumber Sejarah Sekunder",
        href: `${BASE_PATH}/history-research/secondary-sources`,
      },
    ],
  },
  {
    title: "Penulisan Sejarah",
    description:
      "Keahlian menceritakan masa lalu dengan objektif dan meyakinkan untuk generasi mendatang.",
    href: `${BASE_PATH}/history-writing`,
    items: [
      {
        title: "Apa itu Historiografi?",
        href: `${BASE_PATH}/history-writing/historiography`,
      },
      {
        title: "Menghindari Bias Sejarah",
        href: `${BASE_PATH}/history-writing/avoiding-bias`,
      },
      {
        title: "Bagaimana melakukan Penelitian dan Penulisan Sejarah?",
        href: `${BASE_PATH}/history-writing/how-history-research`,
      },
    ],
  },
] as const;

export default idMaterials;
