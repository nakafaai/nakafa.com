import type { MaterialList } from "@/types/subjects";
import { BASE_PATH } from ".";

const idMaterials: MaterialList[] = [
  {
    title: "Eksponen dan Logaritma",
    description:
      "Kekuatan matematika di balik teknologi modern dan pertumbuhan eksponensial.",
    href: `${BASE_PATH}/exponential-logarithm`,
    items: [
      {
        title: "Konsep Eksponen",
        href: `${BASE_PATH}/exponential-logarithm/basic-concept`,
      },
      {
        title: "Sifat Eksponen",
        href: `${BASE_PATH}/exponential-logarithm/properties`,
      },
      {
        title: "Pembuktian Sifat",
        href: `${BASE_PATH}/exponential-logarithm/proof-properties`,
      },
      {
        title: "Eksplorasi Fungsi",
        href: `${BASE_PATH}/exponential-logarithm/function-exploration`,
      },
      {
        title: "Definisi Fungsi",
        href: `${BASE_PATH}/exponential-logarithm/function-definition`,
      },
      {
        title: "Perbandingan Fungsi",
        href: `${BASE_PATH}/exponential-logarithm/function-comparison`,
      },
      {
        title: "Pemodelan Fungsi",
        href: `${BASE_PATH}/exponential-logarithm/function-modeling`,
      },
      {
        title: "Peluruhan Eksponen",
        href: `${BASE_PATH}/exponential-logarithm/exponential-decay`,
      },
      {
        title: "Bentuk Akar",
        href: `${BASE_PATH}/exponential-logarithm/radical-form`,
      },
      {
        title: "Merasionalkan Akar",
        href: `${BASE_PATH}/exponential-logarithm/rationalizing-radicals`,
      },
      {
        title: "Definisi Logaritma",
        href: `${BASE_PATH}/exponential-logarithm/logarithm-definition`,
      },
      {
        title: "Sifat Logaritma",
        href: `${BASE_PATH}/exponential-logarithm/logarithm-properties`,
      },
    ],
  },
  {
    title: "Barisan dan Deret",
    description:
      "Pola menakjubkan yang menghubungkan angka-angka dalam urutan menarik.",
    href: `${BASE_PATH}/sequence-series`,
    items: [],
  },
  {
    title: "Vektor dan Operasinya",
    description: "Konsep dasar game 3D, fisika, dan navigasi satelit.",
    href: `${BASE_PATH}/vector-operations`,
    items: [],
  },
  {
    title: "Trigonometri",
    description:
      "Bahasa segitiga untuk membangun gedung dan menjelajahi antariksa.",
    href: `${BASE_PATH}/trigonometry`,
    items: [],
  },
  {
    title: "Sistem Persamaan dan Pertidaksamaan Linear",
    description:
      "Kunci untuk mengoptimalkan bisnis dan menyelesaikan masalah nyata.",
    href: `${BASE_PATH}/linear-equation-inequality`,
    items: [],
  },
  {
    title: "Fungsi Kuadrat",
    description:
      "Kurva parabola yang menjelaskan lintasan peluru dan desain jembatan.",
    href: `${BASE_PATH}/quadratic-function`,
    items: [],
  },
  {
    title: "Statistika",
    description:
      "Seni analisis data untuk pengambilan keputusan di dunia nyata.",
    href: `${BASE_PATH}/statistics`,
    items: [],
  },
  {
    title: "Peluang",
    description:
      "Matematika ketidakpastian di balik AI, prediksi cuaca, dan strategi game.",
    href: `${BASE_PATH}/probability`,
    items: [],
  },
] as const;

export default idMaterials;
