import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Sistem Persamaan Linear Dua Variabel",
    description:
      "Menyelesaikan masalah dengan dua variabel yang saling terkait.",
    href: `${BASE_PATH}/linear-equations-two-variables`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
  {
    title: "Bangun Ruang",
    description: "Menjelajahi volume dan luas permukaan objek 3D.",
    href: `${BASE_PATH}/solid-geometry`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
  {
    title: "Transformasi Geometri",
    description: "Memindahkan dan mengubah bentuk geometri.",
    href: `${BASE_PATH}/geometric-transformation`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
  {
    title: "Peluang dan Pemilihan Sampel",
    description: "Memprediksi kemungkinan dan memahami pengambilan sampel.",
    href: `${BASE_PATH}/probability-sampling`,
    items: [
      {
        title: "",
        href: `${BASE_PATH}/`,
      },
    ],
  },
] as const;

export default idMaterials;
