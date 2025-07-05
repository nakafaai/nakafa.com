import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Metode Linear AI",
    description:
      "Tulang punggung matematika yang mengubah pola data menjadi prediksi cerdas.",
    href: `${BASE_PATH}/linear-methods`,
    items: [
      {
        title: "Definisi Determinan",
        href: `${BASE_PATH}/linear-methods/determinant`,
      },
      {
        title: "Perhitungan Determinan",
        href: `${BASE_PATH}/linear-methods/determinant-calculation`,
      },
      {
        title: "Teorema pengembangan Laplace",
        href: `${BASE_PATH}/linear-methods/laplace-expansion`,
      },
      {
        title: "Aturan Cramer",
        href: `${BASE_PATH}/linear-methods/cramer-rule`,
      },
      {
        title: "Ruang Vektor Kompleks",
        href: `${BASE_PATH}/linear-methods/complex-vector-space`,
      },
      {
        title: "Matriks Kompleks",
        href: `${BASE_PATH}/linear-methods/complex-matrix`,
      },
      {
        title: "Nilai Eigen, Vektor Eigen, dan Ruang Eigen",
        href: `${BASE_PATH}/linear-methods/eigenvalue-eigenvector-eigenspace`,
      },
      {
        title: "Karakteristik Polinomial",
        href: `${BASE_PATH}/linear-methods/characteristic-polynomial`,
      },
      {
        title: "Nilai Eigen dari Matriks Diagonal dan Segitiga",
        href: `${BASE_PATH}/linear-methods/eigenvalue-diagonal-matrix`,
      },
      {
        title: "Matriks Ortogonal dan Uniter",
        href: `${BASE_PATH}/linear-methods/orthogonal-unitary-matrix`,
      },
      {
        title: "Matriks simetris dan Hermitian",
        href: `${BASE_PATH}/linear-methods/symmetric-hermitian-matrix`,
      },
      {
        title: "Matriks Definit Positif",
        href: `${BASE_PATH}/linear-methods/positive-definite-matrix`,
      },
      {
        title: "Produk Skalar",
        href: `${BASE_PATH}/linear-methods/scalar-product`,
      },
      {
        title: "Kondisi Matriks",
        href: `${BASE_PATH}/linear-methods/matrix-condition`,
      },
      {
        title: "LU Dekomposisi",
        href: `${BASE_PATH}/linear-methods/lu-decomposition`,
      },
      {
        title: "Cholesky Dekomposisi",
        href: `${BASE_PATH}/linear-methods/cholesky-decomposition`,
      },
      {
        title: "QR Dekomposisi",
        href: `${BASE_PATH}/linear-methods/qr-decomposition`,
      },
      {
        title: "Linear Model",
        href: `${BASE_PATH}/linear-methods/linear-model`,
      },
      {
        title: "Sistem Persamaan Linear",
        href: `${BASE_PATH}/linear-methods/system-linear-equation`,
      },
      {
        title: "Masalah Keseimbangan Linear",
        href: `${BASE_PATH}/linear-methods/linear-equilibrium-problem`,
      },
      {
        title: "Sistem Persamaan Normal",
        href: `${BASE_PATH}/linear-methods/normal-equation`,
      },
      {
        title: "Solusi Sistem Persamaan Normal",
        href: `${BASE_PATH}/linear-methods/normal-equation-solution`,
      },
      {
        title: "Kemampuan Identifikasi dan Pemeringkatan",
        href: `${BASE_PATH}/linear-methods/identifiability-ranking`,
      },
      {
        title: "Regularisasi",
        href: `${BASE_PATH}/linear-methods/regularization`,
      },
      {
        title: "Analisis Statistik",
        href: `${BASE_PATH}/linear-methods/statistical-analysis`,
      },
      {
        title: "Perkiraan Terbaik dalam Fungsi dan Ruang Polinomial",
        href: `${BASE_PATH}/linear-methods/approximation-function-polynomial`,
      },
      {
        title: "Proyeksi Ortogonal",
        href: `${BASE_PATH}/linear-methods/orthogonal-projection`,
      },
      {
        title: "Polinomial Ortogonal",
        href: `${BASE_PATH}/linear-methods/orthogonal-polynomials`,
      },
      {
        title: "Kesamaan Matriks",
        href: `${BASE_PATH}/linear-methods/matrix-equality`,
      },
      {
        title: "Diagonalisasi Matriks",
        href: `${BASE_PATH}/linear-methods/diagonalization-matrix`,
      },
      {
        title: "Prosedur Dasar untuk Diagonalisasi",
        href: `${BASE_PATH}/linear-methods/diagonalization-procedure`,
      },
      {
        title: "Teorema Spektral",
        href: `${BASE_PATH}/linear-methods/spectral-theorem`,
      },
      {
        title: "Teorema Spektral untuk Matriks Kompleks",
        href: `${BASE_PATH}/linear-methods/spectral-complex-matrix`,
      },
      {
        title: "Teorema Spektral untuk Matriks Nyata",
        href: `${BASE_PATH}/linear-methods/spectral-real-matrix`,
      },
      {
        title: "Transformasi Sumbu Nyata",
        href: `${BASE_PATH}/linear-methods/real-axis-transformation`,
      },
      {
        title: "Contoh Analisis Komponen Utama",
        href: `${BASE_PATH}/linear-methods/principal-component-analysis`,
      },
      {
        title: "Trigonalisasi dan Bentuk Normal Jordan",
        href: `${BASE_PATH}/linear-methods/jordan-normal-form`,
      },
      {
        title: "Perhitungan Numerik dari Nilai Eigen",
        href: `${BASE_PATH}/linear-methods/numerical-eigenvalue-calculation`,
      },
      {
        title: "Perhitungan Nilai Eigen Individu",
        href: `${BASE_PATH}/linear-methods/individual-eigenvalue-calculation`,
      },
      {
        title: "Perhitungan Semua Nilai Eigen",
        href: `${BASE_PATH}/linear-methods/all-eigenvalues-calculation`,
      },
    ],
  },
  {
    title: "Pemrograman AI",
    description:
      "Mengkode kecerdasan yang mengajarkan mesin berpikir dan memecahkan masalah kompleks.",
    href: `${BASE_PATH}/ai-programming`,
    items: [],
  },
  {
    title: "Neural Networks",
    description:
      "Otak digital yang meniru neuron manusia untuk mengenali pola dan membuat keputusan.",
    href: `${BASE_PATH}/neural-networks`,
    items: [],
  },
  {
    title: "Machine Learning",
    description:
      "Algoritma yang belajar dari pengalaman untuk memprediksi hasil masa depan secara otomatis.",
    href: `${BASE_PATH}/machine-learning`,
    items: [],
  },
  {
    title: "Optimisasi Nonlinear untuk AI",
    description:
      "Matematika lanjutan yang menemukan solusi optimal dalam ruang masalah AI yang kompleks.",
    href: `${BASE_PATH}/nonlinear-optimization`,
    items: [],
  },
  {
    title: "Advanced Machine Learning",
    description:
      "Teknik mutakhir yang mendorong batas kemampuan kecerdasan buatan.",
    href: `${BASE_PATH}/advanced-machine-learning`,
    items: [],
  },
  {
    title: "Computer Vision",
    description:
      "Mengajarkan mesin untuk melihat dan memahami dunia visual seperti manusia.",
    href: `${BASE_PATH}/computer-vision`,
    items: [],
  },
  {
    title: "Natural Language Processing",
    description:
      "Menjembatani bahasa manusia dan pemahaman mesin untuk komunikasi yang mulus.",
    href: `${BASE_PATH}/nlp`,
    items: [],
  },
] as const;

export default idMaterials;
