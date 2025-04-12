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
        title: "Pertumbuhan Eksponen",
        href: `${BASE_PATH}/exponential-logarithm/exponential-growth`,
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
    items: [
      {
        title: "Konsep Barisan",
        href: `${BASE_PATH}/sequence-series/sequence-concept`,
      },
      {
        title: "Barisan Aritmetika",
        href: `${BASE_PATH}/sequence-series/arithmetic-sequence`,
      },
      {
        title: "Barisan Geometri",
        href: `${BASE_PATH}/sequence-series/geometric-sequence`,
      },
      {
        title: "Perbedaan Barisan Aritmetika dan Geometri",
        href: `${BASE_PATH}/sequence-series/difference-arithmetic-geometric-sequence`,
      },
      {
        title: "Konsep Deret",
        href: `${BASE_PATH}/sequence-series/series-concept`,
      },
      {
        title: "Deret Aritmetika",
        href: `${BASE_PATH}/sequence-series/arithmetic-series`,
      },
      {
        title: "Deret Geometri",
        href: `${BASE_PATH}/sequence-series/geometric-series`,
      },
      {
        title: "Deret Geometri Tak Hingga",
        href: `${BASE_PATH}/sequence-series/infinite-geometric-series`,
      },
      {
        title: "Perbedaan Konvergen dan Divergen",
        href: `${BASE_PATH}/sequence-series/convergence-divergence`,
      },
      {
        title: "Perbedaan Deret Aritmetika dan Geometri",
        href: `${BASE_PATH}/sequence-series/difference-arithmetic-geometric-series`,
      },
      {
        title: "Perbedaan Barisan dan Deret",
        href: `${BASE_PATH}/sequence-series/difference-sequence-series`,
      },
    ],
  },
  {
    title: "Vektor dan Operasinya",
    description: "Konsep dasar game 3D, fisika, dan navigasi satelit.",
    href: `${BASE_PATH}/vector-operations`,
    items: [
      {
        title: "Konsep Vektor",
        href: `${BASE_PATH}/vector-operations/vector-concept`,
      },
      {
        title: "Jenis-jenis Vektor",
        href: `${BASE_PATH}/vector-operations/vector-types`,
      },
      {
        title: "Vektor dan Sistem Koordinat",
        href: `${BASE_PATH}/vector-operations/vector-coordinate-system`,
      },
      {
        title: "Vektor Dua Dimensi",
        href: `${BASE_PATH}/vector-operations/two-dimensional-vector`,
      },
      {
        title: "Komponen Vektor",
        href: `${BASE_PATH}/vector-operations/vector-components`,
      },
      {
        title: "Vektor Ekuivalen",
        href: `${BASE_PATH}/vector-operations/equivalent-vector`,
      },
      {
        title: "Vektor Tiga Dimensi",
        href: `${BASE_PATH}/vector-operations/three-dimensional-vector`,
      },
      {
        title: "Vektor Kolom dan Baris",
        href: `${BASE_PATH}/vector-operations/column-row-vector`,
      },
      {
        title: "Vektor Satuan dari Suatu Vektor",
        href: `${BASE_PATH}/vector-operations/unit-vector`,
      },
      {
        title: "Vektor Posisi",
        href: `${BASE_PATH}/vector-operations/position-vector`,
      },
      {
        title: "Vektor Berkebalikan",
        href: `${BASE_PATH}/vector-operations/opposite-vector`,
      },
      {
        title: "Penjumlahan Vektor",
        href: `${BASE_PATH}/vector-operations/vector-addition`,
      },
      {
        title: "Pengurangan Vektor",
        href: `${BASE_PATH}/vector-operations/vector-subtraction`,
      },
      {
        title: "Vektor Nol",
        href: `${BASE_PATH}/vector-operations/zero-vector`,
      },
      {
        title: "Perkalian Skalar Vektor",
        href: `${BASE_PATH}/vector-operations/scalar-multiplication`,
      },
    ],
  },
  {
    title: "Trigonometri",
    description:
      "Bahasa segitiga untuk membangun gedung dan menjelajahi antariksa.",
    href: `${BASE_PATH}/trigonometry`,
    items: [
      {
        title: "Konsep Trigonometri",
        href: `${BASE_PATH}/trigonometry/trigonometry-concept`,
      },
      {
        title: "Penamaan Sisi Segitiga Siku-siku",
        href: `${BASE_PATH}/trigonometry/right-triangle-naming`,
      },
      {
        title: "Perbandingan Trigonometri: Tan θ",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-tan`,
      },
      {
        title: "Kegunaan Perbandingan Trigonometri Tan θ",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-tan-usage`,
      },
      {
        title: "Perbandingan Trigonometri: Sin θ dan Cos θ",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-sin-cos`,
      },
      {
        title: "Tiga Serangkai Perbandingan Trigonometri",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-three-primary`,
      },
      {
        title: "Sudut Istimewa Perbandingan Trigonometri",
        href: `${BASE_PATH}/trigonometry/trigonometric-comparison-special-angle`,
      },
    ],
  },
  {
    title: "Sistem Persamaan dan Pertidaksamaan Linear",
    description:
      "Kunci untuk mengoptimalkan bisnis dan menyelesaikan masalah nyata.",
    href: `${BASE_PATH}/linear-equation-inequality`,
    items: [
      {
        title: "Sistem Persamaan Linear",
        href: `${BASE_PATH}/linear-equation-inequality/system-linear-equation`,
      },
      {
        title: "Sistem Pertidaksamaan Linear",
        href: `${BASE_PATH}/linear-equation-inequality/system-linear-inequality`,
      },
    ],
  },
  {
    title: "Persamaan dan Fungsi Kuadrat",
    description:
      "Kurva parabola yang menjelaskan lintasan peluru dan desain jembatan.",
    href: `${BASE_PATH}/quadratic-function`,
    items: [
      {
        title: "Persamaan Kuadrat",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation`,
      },
      {
        title: "Faktorisasi Persamaan Kuadrat",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-factorization`,
      },
      {
        title: "Melengkapi Kuadrat Sempurna",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-perfect-square`,
      },
      {
        title: "Rumus Persamaan Kuadrat",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-formula`,
      },
      {
        title: "Jenis-Jenis Akar Persamaan Kuadrat",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-types-of-root`,
      },
      {
        title: "Akar Tidak Nyata atau Imajiner",
        href: `${BASE_PATH}/quadratic-function/quadratic-equation-imaginary-root`,
      },
      {
        title: "Karakteristik Fungsi Kuadrat",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-characteristics`,
      },
      {
        title: "Mengonstruksi Fungsi Kuadrat",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-construction`,
      },
      {
        title: "Menentukan Luas Maksimum",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-maximum-area`,
      },
      {
        title: "Menentukan Luas Minimum",
        href: `${BASE_PATH}/quadratic-function/quadratic-function-minimum-area`,
      },
    ],
  },
  {
    title: "Statistika",
    description:
      "Seni analisis data untuk pengambilan keputusan di dunia nyata.",
    href: `${BASE_PATH}/statistics`,
    items: [
      {
        title: "Histogram",
        href: `${BASE_PATH}/statistics/histogram`,
      },
      {
        title: "Frekuensi Relatif",
        href: `${BASE_PATH}/statistics/relative-frequency`,
      },
      {
        title: "Modus dan Median",
        href: `${BASE_PATH}/statistics/mode-median`,
      },
      {
        title: "Mean (Rerata atau Rata-rata)",
        href: `${BASE_PATH}/statistics/mean`,
      },
      {
        title: "Penggunaan Ukuran Pemusatan",
        href: `${BASE_PATH}/statistics/central-tendency-usage`,
      },
      {
        title: "Mean/Rata-Rata Data Kelompok",
        href: `${BASE_PATH}/statistics/mean-group-data`,
      },
      {
        title: "Median dan Kelas Modus Data Kelompok",
        href: `${BASE_PATH}/statistics/median-mode-group-data`,
      },
      {
        title: "Kuartil Data Tunggal",
        href: `${BASE_PATH}/statistics/quartile-data-single`,
      },
      {
        title: "Persentil Data Kelompok",
        href: `${BASE_PATH}/statistics/percentile-data-group`,
      },
      {
        title: "Jangkauan Interkuartil",
        href: `${BASE_PATH}/statistics/interquartile-range`,
      },
      {
        title: "Varian dan Simpangan Baku Data Tunggal",
        href: `${BASE_PATH}/statistics/variance-standard-deviation-data-single`,
      },
      {
        title: "Varian dan Simpangan Baku Data Kelompok",
        href: `${BASE_PATH}/statistics/variance-standard-deviation-data-group`,
      },
    ],
  },
  {
    title: "Peluang",
    description:
      "Matematika ketidakpastian di balik AI, prediksi cuaca, dan strategi game.",
    href: `${BASE_PATH}/probability`,
    items: [
      {
        title: "Distribusi Peluang",
        href: `${BASE_PATH}/probability/probability-distribution`,
      },
      {
        title: "Aturan Penjumlahan",
        href: `${BASE_PATH}/probability/addition-rule`,
      },
      {
        title: "Dua Kejadian A dan B Saling Lepas",
        href: `${BASE_PATH}/probability/two-events-mutually-exclusive`,
      },
      {
        title: "Dua Kejadian A dan B Tidak Saling Lepas",
        href: `${BASE_PATH}/probability/two-events-not-mutually-exclusive`,
      },
    ],
  },
] as const;

export default idMaterials;
