import type { MaterialList } from "@/types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Komposisi Fungsi dan Fungsi Invers",
    description:
      "Aljabar canggih yang mendasari enkripsi data dan algoritma komputer modern.",
    href: `${BASE_PATH}/function-composition-inverse-function`,
    items: [
      {
        title: "Konsep Fungsi",
        href: `${BASE_PATH}/function-composition-inverse-function/function-concept`,
      },
      {
        title: "Fungsi dan Bukan Fungsi",
        href: `${BASE_PATH}/function-composition-inverse-function/function-and-non-function`,
      },
      {
        title: "Domain, Kodomain, dan Range",
        href: `${BASE_PATH}/function-composition-inverse-function/domain-codomain-range`,
      },
      {
        title: "Penjumlahan dan Pengurangan Fungsi",
        href: `${BASE_PATH}/function-composition-inverse-function/addition-subtraction-function`,
      },
      {
        title: "Perkalian dan Pembagian Fungsi",
        href: `${BASE_PATH}/function-composition-inverse-function/multiplication-division-function`,
      },
      {
        title: "Komposisi Fungsi",
        href: `${BASE_PATH}/function-composition-inverse-function/function-composition`,
      },
      {
        title: "Sifat Komposisi Fungsi",
        href: `${BASE_PATH}/function-composition-inverse-function/properties-of-function-composition`,
      },
      {
        title: "Fungsi Invers",
        href: `${BASE_PATH}/function-composition-inverse-function/inverse-function`,
      },
      {
        title: "Sifat Fungsi Invers",
        href: `${BASE_PATH}/function-composition-inverse-function/properties-of-inverse-function`,
      },
      {
        title: "Fungsi Injektif, Surjektif, dan Bijektif",
        href: `${BASE_PATH}/function-composition-inverse-function/injective-surjective-bijective-function`,
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
        href: `${BASE_PATH}/circle/circle-and-arc-circle`,
      },
      {
        title: "Sudut Pusat dan Sudut Keliling",
        href: `${BASE_PATH}/circle/central-angle-and-inscribed-angle`,
      },
      {
        title: "Sifat Sudut pada Lingkaran",
        href: `${BASE_PATH}/circle/properties-of-angle-in-circle`,
      },
      {
        title: "Lingkaran dan Garis Singgung",
        href: `${BASE_PATH}/circle/circle-and-tangent-line`,
      },
      {
        title: "Garis Singgung Persekutuan Luar dan Dalam",
        href: `${BASE_PATH}/circle/external-tangent-line-and-internal-tangent-line`,
      },
      {
        title: "Lingkaran dan Tali Busur",
        href: `${BASE_PATH}/circle/circle-and-chord`,
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
        href: `${BASE_PATH}/statistics/scatter-diagram`,
      },
      {
        title: "Konsep Regresi Linear",
        href: `${BASE_PATH}/statistics/linear-regression-concept`,
      },
      {
        title: "Metode Kuadrat Terkecil",
        href: `${BASE_PATH}/statistics/least-square-method`,
      },
      {
        title: "Konsep Analisis Korelasi",
        href: `${BASE_PATH}/statistics/correlation-analysis-concept`,
      },
      {
        title: "Korelasi Product Moment",
        href: `${BASE_PATH}/statistics/product-moment-correlation`,
      },
      {
        title: "Koefisien Determinasi",
        href: `${BASE_PATH}/statistics/coefficient-of-determination`,
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
        href: `${BASE_PATH}/complex-number/complex-number-concept`,
      },
      {
        title: "Bentuk Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/complex-number-form`,
      },
      {
        title: "Penjumlahan Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/addition-complex-numbers`,
      },
      {
        title: "Sifat Penjumlahan Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/properties-addition-complex-numbers`,
      },
      {
        title: "Perkalian Skalar Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/scalar-multiplication-complex-numbers`,
      },
      {
        title: "Perkalian Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/multiplication-complex-numbers`,
      },
      {
        title: "Sifat Perkalian Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/properties-multiplication-complex-numbers`,
      },
      {
        title: "Invers Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/inverse-complex-numbers`,
      },
      {
        title: "Sifat Operasi Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/properties-operation-complex-numbers`,
      },
      {
        title: "Konjugat Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/conjugate-complex-numbers`,
      },
      {
        title: "Modulus dan Argumen Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/modulus-argument-complex-numbers`,
      },
      {
        title: "Sifat Operasi Modulus Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/properties-modulus-complex-numbers`,
      },
      {
        title: "Argumen Utama Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/principal-argument-complex-numbers`,
      },
      {
        title: "Sifat Argumen Utama Bilangan Kompleks",
        href: `${BASE_PATH}/complex-number/properties-principal-argument-complex-numbers`,
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
        href: `${BASE_PATH}/polynomial/polynomial-concept`,
      },
      {
        title: "Derajat Polinomial",
        href: `${BASE_PATH}/polynomial/polynomial-degree`,
      },
      {
        title: "Fungsi Polinomial",
        href: `${BASE_PATH}/polynomial/polynomial-function`,
      },
      {
        title: "Grafik Fungsi Polinomial",
        href: `${BASE_PATH}/polynomial/polynomial-graph`,
      },
      {
        title: "Penjumlahan dan Pengurangan Polinomial",
        href: `${BASE_PATH}/polynomial/addition-subtraction-polynomial`,
      },
      {
        title: "Perkalian Polinomial",
        href: `${BASE_PATH}/polynomial/multiplication-polynomial`,
      },
      {
        title: "Pembagian Polinomial",
        href: `${BASE_PATH}/polynomial/division-polynomial`,
      },
      {
        title: "Pembagian Bersusun",
        href: `${BASE_PATH}/polynomial/synthetic-division`,
      },
      {
        title: "Metode Horner",
        href: `${BASE_PATH}/polynomial/horner-method`,
      },
      {
        title: "Teorema Sisa",
        href: `${BASE_PATH}/polynomial/remainder-theorem`,
      },
      {
        title: "Teorema Faktor",
        href: `${BASE_PATH}/polynomial/factor-theorem`,
      },
      {
        title: "Pembuat Nol Rasional",
        href: `${BASE_PATH}/polynomial/rational-zero`,
      },
      {
        title: "Faktorisasi Penuh Polinomial",
        href: `${BASE_PATH}/polynomial/polynomial-factorization`,
      },
      {
        title: "Identitas Polinomial",
        href: `${BASE_PATH}/polynomial/polynomial-identity`,
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
        href: `${BASE_PATH}/matrix/matrix-concept`,
      },
      {
        title: "Jenis-Jenis Matriks",
        href: `${BASE_PATH}/matrix/matrix-types`,
      },
      {
        title: "Matriks Transpos",
        href: `${BASE_PATH}/matrix/matrix-transpose`,
      },
      {
        title: "Kesamaan Dua Matriks",
        href: `${BASE_PATH}/matrix/matrix-equality`,
      },
      {
        title: "Penjumlahan Matriks",
        href: `${BASE_PATH}/matrix/matrix-addition`,
      },
      {
        title: "Pengurangan Matriks",
        href: `${BASE_PATH}/matrix/matrix-subtraction`,
      },
      {
        title: "Perkalian Matriks dengan Skalar",
        href: `${BASE_PATH}/matrix/matrix-scalar-multiplication`,
      },
      {
        title: "Perkalian Dua Matriks",
        href: `${BASE_PATH}/matrix/matrix-multiplication`,
      },
      {
        title: "Determinan Matriks",
        href: `${BASE_PATH}/matrix/matrix-determinant`,
      },
      {
        title: "Metode Sarrus",
        href: `${BASE_PATH}/matrix/sarrus-method`,
      },
      {
        title: "Metode Ekspansi Kofaktor",
        href: `${BASE_PATH}/matrix/cofactor-expansion-method`,
      },
      {
        title: "Sifat Determinan Matriks",
        href: `${BASE_PATH}/matrix/properties-determinant-matrix`,
      },
      {
        title: "Invers Matriks",
        href: `${BASE_PATH}/matrix/matrix-inverse`,
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
        href: `${BASE_PATH}/geometric-transformation/reflection-over-line`,
      },
      {
        title: "Pencerminan terhadap Sumbu X",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-x-axis`,
      },
      {
        title: "Pencerminan terhadap Sumbu Y",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-y-axis`,
      },
      {
        title: "Pencerminan terhadap Garis y = x",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-y-equals-x`,
      },
      {
        title: "Pencerminan terhadap Garis y = -x",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-y-equals-minus-x`,
      },
      {
        title: "Pencerminan terhadap Garis x = k",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-x-equals-k`,
      },
      {
        title: "Pencerminan terhadap Garis y = h",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-y-equals-h`,
      },
      {
        title: "Pencerminan terhadap Titik",
        href: `${BASE_PATH}/geometric-transformation/reflection-over-point`,
      },
      {
        title: "Translasi",
        href: `${BASE_PATH}/geometric-transformation/translation`,
      },
      {
        title: "Rotasi",
        href: `${BASE_PATH}/geometric-transformation/rotation`,
      },
      {
        title: "Dilatasi",
        href: `${BASE_PATH}/geometric-transformation/dilation`,
      },
      {
        title: "Kaitan Matriks dengan Transformasi",
        href: `${BASE_PATH}/geometric-transformation/matrix-transformation`,
      },
      {
        title: "Matriks Pencerminan",
        href: `${BASE_PATH}/geometric-transformation/reflection-matrix`,
      },
      {
        title: "Matriks Pencerminan terhadap Titik Pusat",
        href: `${BASE_PATH}/geometric-transformation/reflection-matrix-center`,
      },
      {
        title: "Matriks Pencerminan terhadap Sebarang Titik",
        href: `${BASE_PATH}/geometric-transformation/reflection-matrix-arbitrary-point`,
      },
      {
        title: "Matriks Translasi",
        href: `${BASE_PATH}/geometric-transformation/translation-matrix`,
      },
      {
        title: "Matriks Rotasi",
        href: `${BASE_PATH}/geometric-transformation/rotation-matrix`,
      },
      {
        title: "Matriks Dilatasi",
        href: `${BASE_PATH}/geometric-transformation/dilation-matrix`,
      },
      {
        title: "Matriks Transformasi Komposisi",
        href: `${BASE_PATH}/geometric-transformation/composite-transformation-matrix`,
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
        href: `${BASE_PATH}/function-modeling/trigonometric-function-arbitrary-angle`,
      },
      {
        title: "Identitas Trigonometri",
        href: `${BASE_PATH}/function-modeling/trigonometric-identity`,
      },
      {
        title: "Grafik Fungsi Trigonometri",
        href: `${BASE_PATH}/function-modeling/trigonometric-function-graph`,
      },
      {
        title: "Konsep Fungsi Logaritma",
        href: `${BASE_PATH}/function-modeling/logarithmic-function-concept`,
      },
      {
        title: "Grafik Fungsi Logaritma",
        href: `${BASE_PATH}/function-modeling/logarithmic-function-graph`,
      },
      {
        title: "Identitas Fungsi Logaritma",
        href: `${BASE_PATH}/function-modeling/logarithmic-function-identity`,
      },
      {
        title: "Fungsi Rasional",
        href: `${BASE_PATH}/function-modeling/rational-function`,
      },
      {
        title: "Asimtot",
        href: `${BASE_PATH}/function-modeling/asymptote`,
      },
      {
        title: "Fungsi Akar",
        href: `${BASE_PATH}/function-modeling/square-root-function`,
      },
      {
        title: "Fungsi Eksponensial",
        href: `${BASE_PATH}/function-modeling/exponential-function`,
      },
      {
        title: "Fungsi Nilai Mutlak",
        href: `${BASE_PATH}/function-modeling/absolute-value-function`,
      },
      {
        title: "Pemodelan Fungsi Tangga",
        href: `${BASE_PATH}/function-modeling/step-function-modeling`,
      },
      {
        title: "Pemodelan Fungsi Piecewise",
        href: `${BASE_PATH}/function-modeling/piecewise-function-modeling`,
      },
    ],
  },
];

export default idMaterials;
