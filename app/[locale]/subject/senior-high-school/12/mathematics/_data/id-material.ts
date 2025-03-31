import type { MaterialList } from "@/types/subjects";
import { BASE_PATH } from ".";

const idMaterials: MaterialList[] = [
  {
    title: "Transformasi Fungsi",
    description:
      "Pergerakan dan perubahan bentuk yang vital dalam animasi dan desain.",
    href: `${BASE_PATH}/function-transformation`,
    items: [
      {
        title: "Translasi Vertikal",
        href: `${BASE_PATH}/vertical-translation`,
      },
      {
        title: "Translasi Horizontal",
        href: `${BASE_PATH}/horizontal-translation`,
      },
      {
        title: "Refleksi Vertikal",
        href: `${BASE_PATH}/vertical-reflection`,
      },
      {
        title: "Refleksi Horizontal",
        href: `${BASE_PATH}/horizontal-reflection`,
      },
      {
        title: "Dilatasi Vertikal",
        href: `${BASE_PATH}/vertical-dilation`,
      },
      {
        title: "Dilatasi Horizontal",
        href: `${BASE_PATH}/horizontal-dilation`,
      },
      {
        title: "Rotasi",
        href: `${BASE_PATH}/rotation`,
      },
      {
        title: "Kombinasi Transformasi Fungsi",
        href: `${BASE_PATH}/combined-transformation-function`,
      },
    ],
  },
  {
    title: "Busur dan Juring Lingkaran",
    description:
      "Bentuk sempurna yang membentuk dasar mekanika roda dan desain arsitektur.",
    href: `${BASE_PATH}/circle-arc-sector`,
    items: [
      {
        title: "Sejarah Nilai Pi",
        href: `${BASE_PATH}/pi-history`,
      },
      {
        title: "Busur",
        href: `${BASE_PATH}/arc`,
      },
      {
        title: "Tali Busur",
        href: `${BASE_PATH}/chord`,
      },
      {
        title: "Sudut Pusat pada Busur",
        href: `${BASE_PATH}/central-angle-on-arc`,
      },
      {
        title: "Busur Lingkaran",
        href: `${BASE_PATH}/circle-arc`,
      },
      {
        title: "Juring",
        href: `${BASE_PATH}/sector`,
      },
      {
        title: "Sudut Pusat pada Juring",
        href: `${BASE_PATH}/central-angle-on-sector`,
      },
      {
        title: "Juring Lingkaran",
        href: `${BASE_PATH}/circle-sector`,
      },
      {
        title: "Hubungan Panjang Busur dan Luas Juring",
        href: `${BASE_PATH}/relationship-between-arc-length-and-sector-area`,
      },
      {
        title: "Tembereng",
        href: `${BASE_PATH}/segment`,
      },
    ],
  },
  {
    title: "Kombinatorik",
    description:
      "Menggabungkan elemen dengan cara yang unik untuk memecahkan masalah kompleks.",
    href: `${BASE_PATH}/combinatorics`,
    items: [
      {
        title: "Aturan Pengisian Tempat",
        href: `${BASE_PATH}/filling-place-rule`,
      },
      {
        title: "Permutasi n Item dari n Objek",
        href: `${BASE_PATH}/permutation-of-n-items-from-n-objects`,
      },
      {
        title: "Permutasi dengan Objek yang Sama",
        href: `${BASE_PATH}/permutation-with-identical-objects`,
      },
      {
        title: "Permutasi Siklis",
        href: `${BASE_PATH}/circular-permutation`,
      },
      {
        title: "Kombinasi",
        href: `${BASE_PATH}/combination`,
      },
      {
        title: "Peluang Suatu Kejadian",
        href: `${BASE_PATH}/probability-of-an-event`,
      },
      {
        title: "Peluang Kejadian Majemuk",
        href: `${BASE_PATH}/probability-of-compound-events`,
      },
      {
        title: "Peluang Kejadian Majemuk Saling Lepas",
        href: `${BASE_PATH}/probability-of-mutually-exclusive-events`,
      },
      {
        title: "Peluang Kejadian Majemuk Saling Bebas",
        href: `${BASE_PATH}/probability-of-independent-events`,
      },
      {
        title: "Peluang Kejadian Majemuk Saling Bebas Bersyarat",
        href: `${BASE_PATH}/probability-of-independent-conditional-events`,
      },
      {
        title: "Binom Newton",
        href: `${BASE_PATH}/binomial-newton`,
      },
    ],
  },
  {
    title: "Geometri Analitik",
    description:
      "Menggabungkan geometri dengan aljabar untuk memahami hubungan antar garis dan kurva.",
    href: `${BASE_PATH}/analytic-geometry`,
    items: [
      {
        title: "Definisi Lingkaran",
        href: `${BASE_PATH}/definition-of-circle`,
      },
      {
        title: "Persamaan Lingkaran",
        href: `${BASE_PATH}/equation-of-circle`,
      },
      {
        title: "Kedudukan Suatu Titik Terhadap Lingkaran",
        href: `${BASE_PATH}/position-of-a-point-to-a-circle`,
      },
      {
        title: "Kedudukan Garis Terhadap Lingkaran",
        href: `${BASE_PATH}/position-of-a-line-to-a-circle`,
      },
      {
        title: "Kedudukan Garis Singgung Lingkaran",
        href: `${BASE_PATH}/position-of-a-tangent-line-to-a-circle`,
      },
      {
        title: "Persamaan Garis Singgung Lingkaran",
        href: `${BASE_PATH}/equation-of-a-tangent-line-to-a-circle`,
      },
      {
        title: "Kedudukan Dua Lingkaran",
        href: `${BASE_PATH}/position-of-two-circles`,
      },
      {
        title: "Parabola",
        href: `${BASE_PATH}/parabola`,
      },
      {
        title: "Elips",
        href: `${BASE_PATH}/ellipse`,
      },
      {
        title: "Hiperbola",
        href: `${BASE_PATH}/hyperbola`,
      },
      {
        title: "Garis Singgung pada Irisan Kerucut",
        href: `${BASE_PATH}/tangent-line-to-conic-sections`,
      },
    ],
  },
  {
    title: "Limit",
    description:
      "Konsep fundamental kalkulus yang menganalisis perilaku fungsi mendekati suatu nilai.",
    href: `${BASE_PATH}/limit`,
    items: [
      {
        title: "Konsep Limit Fungsi",
        href: `${BASE_PATH}/concept-of-limit-function`,
      },
      {
        title: "Sifat Limit Fungsi",
        href: `${BASE_PATH}/properties-of-limit-function`,
      },
      {
        title: "Limit Fungsi Aljabar",
        href: `${BASE_PATH}/limit-of-algebraic-function`,
      },
      {
        title: "Limit Fungsi Trigonometri",
        href: `${BASE_PATH}/limit-of-trigonometric-function`,
      },
      {
        title: "Aplikasi Limit Fungsi",
        href: `${BASE_PATH}/application-of-limit-function`,
      },
    ],
  },
  {
    title: "Turunan Fungsi",
    description:
      "Pengukuran laju perubahan fungsi yang esensial dalam fisika dan optimisasi.",
    href: `${BASE_PATH}/derivative-function`,
    items: [
      {
        title: "Konsep Turunan Fungsi",
        href: `${BASE_PATH}/concept-of-derivative-function`,
      },
      {
        title: "Penulisan Turunan Fungsi",
        href: `${BASE_PATH}/writing-the-derivative-function`,
      },
      {
        title: "Turunan Fungsi Aljabar",
        href: `${BASE_PATH}/derivative-of-algebraic-function`,
      },
      {
        title: "Turunan Fungsi Trigonometri",
        href: `${BASE_PATH}/derivative-of-trigonometric-function`,
      },
      {
        title: "Aturan Rantai pada Turunan",
        href: `${BASE_PATH}/chain-rule-in-derivative`,
      },
      {
        title: "Persamaan Garis Singgung pada Kurva",
        href: `${BASE_PATH}/equation-of-a-tangent-line-to-a-curve`,
      },
      {
        title: "Fungsi Naik, Turun, dan Stasioner",
        href: `${BASE_PATH}/increasing-decreasing-and-stationary-function`,
      },
      {
        title: "Titik Ekstrim, Nilai Balik Maksimum dan Minimum",
        href: `${BASE_PATH}/extrema-maximum-and-minimum-value`,
      },
      {
        title: "Aplikasi Turunan",
        href: `${BASE_PATH}/application-of-derivative`,
      },
    ],
  },
  {
    title: "Integral",
    description:
      "Proses menghitung area dan pengumpulan data dari fungsi yang berlanjut.",
    href: `${BASE_PATH}/integral`,
    items: [
      {
        title: "Definisi Integral Tak Tentu",
        href: `${BASE_PATH}/definition-of-indefinite-integral`,
      },
      {
        title: "Sifat-Sifat Integral Tak Tentu",
        href: `${BASE_PATH}/properties-of-indefinite-integral`,
      },
      {
        title: "Jumlahan Riemann",
        href: `${BASE_PATH}/riemann-sum`,
      },
      {
        title: "Integral Tentu",
        href: `${BASE_PATH}/definite-integral`,
      },
      {
        title: "Sifat-Sifat Integral Tentu",
        href: `${BASE_PATH}/properties-of-definite-integral`,
      },
      {
        title: "Teorema Dasar Kalkulus",
        href: `${BASE_PATH}/fundamental-theorem-of-calculus`,
      },
      {
        title: "Luas Bidang Datar",
        href: `${BASE_PATH}/area-of-a-flat-surface`,
      },
      {
        title: "Integral dalam Bidang Ekonomi dan Bisnis",
        href: `${BASE_PATH}/integral-in-economics-and-business`,
      },
      {
        title: "Integral dalam Bidang Fisika",
        href: `${BASE_PATH}/integral-in-physics`,
      },
    ],
  },
  {
    title: "Analisis Data dan Peluang",
    description:
      "Metode statistik untuk mengolah informasi dan memprediksi kejadian dalam ketidakpastian.",
    href: `${BASE_PATH}/data-analysis-probability`,
    items: [
      {
        title: "Distribusi Seragam",
        href: `${BASE_PATH}/uniform-distribution`,
      },
      {
        title: "Fungsi Distribusi Binomial",
        href: `${BASE_PATH}/binomial-distribution-function`,
      },
      {
        title: "Nilai Harapan Distribusi Binomial",
        href: `${BASE_PATH}/expected-value-of-binomial-distribution`,
      },
      {
        title: "Fungsi Distribusi Normal",
        href: `${BASE_PATH}/normal-distribution-function`,
      },
      {
        title: "Nilai Harapan Distribusi Normal",
        href: `${BASE_PATH}/expected-value-of-normal-distribution`,
      },
    ],
  },
];

export default idMaterials;
