import type { MaterialList } from "@/types/subjects";
import { BASE_PATH } from ".";

const idMaterials: MaterialList[] = [
  {
    title: "Komposisi Fungsi dan Fungsi Invers",
    description:
      "Aljabar canggih yang mendasari enkripsi data dan algoritma komputer modern.",
    href: `${BASE_PATH}/function-composition-inverse-function`,
    items: [
      {
        title: "Konsep Fungsi",
        href: `${BASE_PATH}/function-concept`,
      },
      {
        title: "Fungsi dan Bukan Fungsi",
        href: `${BASE_PATH}/function-and-non-function`,
      },
      {
        title: "Domain, Kodomain, dan Range",
        href: `${BASE_PATH}/domain-codomain-range`,
      },
      {
        title: "Penjumlahan dan Pengurangan Fungsi",
        href: `${BASE_PATH}/addition-subtraction-function`,
      },
      {
        title: "Perkalian dan Pembagian Fungsi",
        href: `${BASE_PATH}/multiplication-division-function`,
      },
      {
        title: "Komposisi Fungsi",
        href: `${BASE_PATH}/function-composition`,
      },
      {
        title: "Sifat Komposisi Fungsi",
        href: `${BASE_PATH}/properties-of-function-composition`,
      },
      {
        title: "Fungsi Invers",
        href: `${BASE_PATH}/inverse-function`,
      },
      {
        title: "Sifat Fungsi Invers",
        href: `${BASE_PATH}/properties-of-inverse-function`,
      },
      {
        title: "Fungsi Injektif, Surjektif, dan Bijektif",
        href: `${BASE_PATH}/injective-surjective-bijective-function`,
      },
    ],
  },
  {
    title: "Lingkaran",
    description:
      "Bentuk sempurna yang membentuk dasar mekanika roda dan desain arsitektur.",
    href: `${BASE_PATH}/circle`,
    items: [
      {
        title: "Lingkaran dan Busur Lingkaran",
        href: `${BASE_PATH}/circle-and-arc-circle`,
      },
      {
        title: "Sudut Pusat dan Sudut Keliling",
        href: `${BASE_PATH}/central-angle-and-inscribed-angle`,
      },
      {
        title: "Sifat Sudut pada Lingkaran",
        href: `${BASE_PATH}/properties-of-angle-in-circle`,
      },
      {
        title: "Lingkaran dan Garis Singgung",
        href: `${BASE_PATH}/circle-and-tangent-line`,
      },
      {
        title: "Garis Singgung Persekutuan Luar dan Dalam",
        href: `${BASE_PATH}/external-tangent-line-and-internal-tangent-line`,
      },
      {
        title: "Lingkaran dan Tali Busur",
        href: `${BASE_PATH}/circle-and-chord`,
      },
    ],
  },
  {
    title: "Statistika",
    description:
      "Bahasa angka untuk menganalisis tren, membuat prediksi, dan mengungkap pola tersembunyi.",
    href: `${BASE_PATH}/statistics`,
    items: [
      {
        title: "Diagram Pencar atau Diagram Scatter",
        href: `${BASE_PATH}/scatter-diagram`,
      },
      {
        title: "Konsep Regresi Linear",
        href: `${BASE_PATH}/linear-regression-concept`,
      },
      {
        title: "Metode Kuadrat Terkecil",
        href: `${BASE_PATH}/least-square-method`,
      },
      {
        title: "Konsep Analisis Korelasi",
        href: `${BASE_PATH}/correlation-analysis-concept`,
      },
      {
        title: "Korelasi Product Moment",
        href: `${BASE_PATH}/product-moment-correlation`,
      },
      {
        title: "Koefisien Determinasi",
        href: `${BASE_PATH}/coefficient-of-determination`,
      },
    ],
  },
  {
    title: "Bilangan Kompleks",
    description:
      "Perluasan matematis yang memungkinkan elektronika modern dan pemrosesan sinyal.",
    href: `${BASE_PATH}/complex-number`,
    items: [
      {
        title: "Konsep Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number-concept`,
      },
      {
        title: "Bentuk Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number-form`,
      },
      {
        title: "Penjumlahan Bilangan Kompleks",
        href: `${BASE_PATH}/addition-complex-numbers`,
      },
      {
        title: "Sifat Penjumlahan Bilangan Kompleks",
        href: `${BASE_PATH}/properties-addition-complex-numbers`,
      },
      {
        title: "Perkalian Skalar Bilangan Kompleks",
        href: `${BASE_PATH}/scalar-multiplication-complex-numbers`,
      },
      {
        title: "Perkalian Bilangan Kompleks",
        href: `${BASE_PATH}/multiplication-complex-numbers`,
      },
      {
        title: "Sifat Perkalian Bilangan Kompleks",
        href: `${BASE_PATH}/properties-multiplication-complex-numbers`,
      },
      {
        title: "Invers Bilangan Kompleks",
        href: `${BASE_PATH}/inverse-complex-numbers`,
      },
      {
        title: "Sifat Operasi Bilangan Kompleks",
        href: `${BASE_PATH}/properties-operation-complex-numbers`,
      },
      {
        title: "Konjugat Bilangan Kompleks",
        href: `${BASE_PATH}/conjugate-complex-numbers`,
      },
      {
        title: "Modulus dan Argumen Bilangan Kompleks",
        href: `${BASE_PATH}/modulus-argument-complex-numbers`,
      },
      {
        title: "Sifat Operasi Modulus Bilangan Kompleks",
        href: `${BASE_PATH}/properties-modulus-complex-numbers`,
      },
      {
        title: "Argumen Utama Bilangan Kompleks",
        href: `${BASE_PATH}/principal-argument-complex-numbers`,
      },
      {
        title: "Sifat Argumen Utama Bilangan Kompleks",
        href: `${BASE_PATH}/properties-principal-argument-complex-numbers`,
      },
    ],
  },
  {
    title: "Polinomial",
    description:
      "Persamaan versatil yang memodelkan berbagai fenomena alam dan proses industri.",
    href: `${BASE_PATH}/polynomial`,
    items: [
      {
        title: "Konsep Polinomial",
        href: `${BASE_PATH}/polynomial-concept`,
      },
      {
        title: "Derajat Polinomial",
        href: `${BASE_PATH}/polynomial-degree`,
      },
      {
        title: "Fungsi Polinomial",
        href: `${BASE_PATH}/polynomial-function`,
      },
      {
        title: "Grafik Fungsi Polinomial",
        href: `${BASE_PATH}/polynomial-graph`,
      },
      {
        title: "Penjumlahan dan Pengurangan Polinomial",
        href: `${BASE_PATH}/addition-subtraction-polynomial`,
      },
      {
        title: "Perkalian Polinomial",
        href: `${BASE_PATH}/multiplication-polynomial`,
      },
      {
        title: "Pembagian Polinomial",
        href: `${BASE_PATH}/division-polynomial`,
      },
      {
        title: "Pembagian Bersusun",
        href: `${BASE_PATH}/synthetic-division`,
      },
      {
        title: "Metode Horner",
        href: `${BASE_PATH}/horner-method`,
      },
      {
        title: "Teorema Sisa",
        href: `${BASE_PATH}/remainder-theorem`,
      },
      {
        title: "Teorema Faktor",
        href: `${BASE_PATH}/factor-theorem`,
      },
      {
        title: "Pembuat Nol Rasional",
        href: `${BASE_PATH}/rational-zero`,
      },
      {
        title: "Faktorisasi Penuh Polinomial",
        href: `${BASE_PATH}/polynomial-factorization`,
      },
      {
        title: "Identitas Polinomial",
        href: `${BASE_PATH}/polynomial-identity`,
      },
    ],
  },
  {
    title: "Matriks",
    description:
      "Struktur matematika yang mendasari grafis komputer, AI, dan analisis jaringan.",
    href: `${BASE_PATH}/matrix`,
    items: [
      {
        title: "Konsep Matriks",
        href: `${BASE_PATH}/matrix-concept`,
      },
      {
        title: "Jenis-Jenis Matriks",
        href: `${BASE_PATH}/matrix-types`,
      },
      {
        title: "Matriks Transpos",
        href: `${BASE_PATH}/matrix-transpose`,
      },
      {
        title: "Kesamaan Dua Matriks",
        href: `${BASE_PATH}/matrix-equality`,
      },
      {
        title: "Penjumlahan Matriks",
        href: `${BASE_PATH}/matrix-addition`,
      },
      {
        title: "Pengurangan Matriks",
        href: `${BASE_PATH}/matrix-subtraction`,
      },
      {
        title: "Perkalian Matriks dengan Skalar",
        href: `${BASE_PATH}/matrix-scalar-multiplication`,
      },
      {
        title: "Perkalian Dua Matriks",
        href: `${BASE_PATH}/matrix-multiplication`,
      },
      {
        title: "Determinan Matriks",
        href: `${BASE_PATH}/matrix-determinant`,
      },
      {
        title: "Metode Sarrus",
        href: `${BASE_PATH}/sarrus-method`,
      },
      {
        title: "Metode Ekspansi Kofaktor",
        href: `${BASE_PATH}/cofactor-expansion-method`,
      },
      {
        title: "Sifat Determinan Matriks",
        href: `${BASE_PATH}/properties-determinant-matrix`,
      },
      {
        title: "Invers Matriks",
        href: `${BASE_PATH}/matrix-inverse`,
      },
    ],
  },
  {
    title: "Transformasi Geometri",
    description:
      "Pergerakan dan perubahan bentuk yang vital dalam animasi dan desain.",
    href: `${BASE_PATH}/geometric-transformation`,
    items: [
      {
        title: "Pencerminan terhadap Garis",
        href: `${BASE_PATH}/reflection-over-line`,
      },
      {
        title: "Pencerminan terhadap Sumbu X",
        href: `${BASE_PATH}/reflection-over-x-axis`,
      },
      {
        title: "Pencerminan terhadap Sumbu Y",
        href: `${BASE_PATH}/reflection-over-y-axis`,
      },
      {
        title: "Pencerminan terhadap Garis y = x",
        href: `${BASE_PATH}/reflection-over-y-equals-x`,
      },
      {
        title: "Pencerminan terhadap Garis y = -x",
        href: `${BASE_PATH}/reflection-over-y-equals-minus-x`,
      },
      {
        title: "Pencerminan terhadap Garis x = k",
        href: `${BASE_PATH}/reflection-over-x-equals-k`,
      },
      {
        title: "Pencerminan terhadap Garis y = h",
        href: `${BASE_PATH}/reflection-over-y-equals-h`,
      },
      {
        title: "Pencerminan terhadap Titik",
        href: `${BASE_PATH}/reflection-over-point`,
      },
      {
        title: "Translasi",
        href: `${BASE_PATH}/translation`,
      },
      {
        title: "Rotasi",
        href: `${BASE_PATH}/rotation`,
      },
      {
        title: "Dilatasi",
        href: `${BASE_PATH}/dilation`,
      },
      {
        title: "Kaitan Matriks dengan Transformasi",
        href: `${BASE_PATH}/matrix-transformation`,
      },
      {
        title: "Matriks Pencerminan",
        href: `${BASE_PATH}/reflection-matrix`,
      },
      {
        title: "Matriks Pencerminan terhadap Titik Pusat",
        href: `${BASE_PATH}/reflection-matrix-center`,
      },
      {
        title: "Matriks Pencerminan terhadap Sebarang Titik",
        href: `${BASE_PATH}/reflection-matrix-arbitrary-point`,
      },
      {
        title: "Matriks Translasi",
        href: `${BASE_PATH}/translation-matrix`,
      },
      {
        title: "Matriks Rotasi",
        href: `${BASE_PATH}/rotation-matrix`,
      },
      {
        title: "Matriks Dilatasi",
        href: `${BASE_PATH}/dilation-matrix`,
      },
      {
        title: "Matriks Transformasi Komposisi",
        href: `${BASE_PATH}/composite-transformation-matrix`,
      },
    ],
  },
  {
    title: "Fungsi dan Pemodelannya",
    description:
      "Alat matematis untuk menggambarkan hubungan dan memprediksi perilaku sistem dunia nyata.",
    href: `${BASE_PATH}/function-modeling`,
    items: [
      {
        title: "Fungsi Trigonometri Sebarang Sudut",
        href: `${BASE_PATH}/trigonometric-function-arbitrary-angle`,
      },
      {
        title: "Identitas Trigonometri",
        href: `${BASE_PATH}/trigonometric-identity`,
      },
      {
        title: "Grafik Fungsi Trigonometri",
        href: `${BASE_PATH}/trigonometric-function-graph`,
      },
      {
        title: "Grafik Fungsi Trigonometri",
        href: `${BASE_PATH}/trigonometric-function-graph`,
      },
      {
        title: "Konsep Fungsi Logaritma",
        href: `${BASE_PATH}/logarithmic-function-concept`,
      },
      {
        title: "Grafik Fungsi Logaritma",
        href: `${BASE_PATH}/logarithmic-function-graph`,
      },
      {
        title: "Identitas Fungsi Logaritma",
        href: `${BASE_PATH}/logarithmic-function-identity`,
      },
      {
        title: "Fungsi Rasional",
        href: `${BASE_PATH}/rational-function`,
      },
      {
        title: "Asimtot",
        href: `${BASE_PATH}/asymptote`,
      },
      {
        title: "Fungsi Akar",
        href: `${BASE_PATH}/square-root-function`,
      },
      {
        title: "Fungsi Eksponensial",
        href: `${BASE_PATH}/exponential-function`,
      },
      {
        title: "Fungsi Nilai Mutlak",
        href: `${BASE_PATH}/absolute-value-function`,
      },
      {
        title: "Pemodelan Fungsi Tangga",
        href: `${BASE_PATH}/step-function-modeling`,
      },
      {
        title: "Pemodelan Fungsi Piecewise",
        href: `${BASE_PATH}/piecewise-function-modeling`,
      },
    ],
  },
];

export default idMaterials;
