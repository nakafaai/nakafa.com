import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonAiDsLinearMethodsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/ai-ds/linear-methods",
  domain: "ai-ds",
  key: "lesson.ai-ds.linear-methods",
  kind: "lesson",
  slug: "linear-methods",
  routeSlugs: { en: "linear-methods", id: "metode-linear-ai" },
  translations: {
    en: {
      description: "Estimate eigenvalues through QR iteration.",
      title: "Linear Methods of AI",
    },
    id: {
      description: "Perkirakan nilai eigen lewat iterasi QR.",
      title: "Metode Linear AI",
    },
  },
  sections: [
    {
      slug: "all-eigenvalues-calculation",
      routeSlugs: {
        en: "all-eigenvalues-calculation",
        id: "perhitungan-semua-nilai-eigen",
      },
      translations: {
        en: {
          title: "All Eigenvalues Calculation",
        },
        id: {
          title: "Perhitungan Semua Nilai Eigen",
        },
      },
    },
    {
      slug: "approximation-function-polynomial",
      routeSlugs: {
        en: "approximation-function-polynomial",
        id: "perkiraan-terbaik-dalam-fungsi-dan-ruang-polinomial",
      },
      translations: {
        en: {
          title: "Best Approximation in Function and Polynomial Spaces",
        },
        id: {
          title: "Perkiraan Terbaik dalam Fungsi dan Ruang Polinomial",
        },
      },
    },
    {
      slug: "characteristic-polynomial",
      routeSlugs: {
        en: "characteristic-polynomial",
        id: "karakteristik-polinomial",
      },
      translations: {
        en: {
          title: "Characteristic Polynomial",
        },
        id: {
          title: "Karakteristik Polinomial",
        },
      },
    },
    {
      slug: "cholesky-decomposition",
      routeSlugs: { en: "cholesky-decomposition", id: "cholesky-dekomposisi" },
      translations: {
        en: {
          title: "Cholesky Decomposition",
        },
        id: {
          title: "Cholesky Dekomposisi",
        },
      },
    },
    {
      slug: "complex-matrix",
      routeSlugs: { en: "complex-matrix", id: "matriks-kompleks" },
      translations: {
        en: {
          title: "Complex Matrix",
        },
        id: {
          title: "Matriks Kompleks",
        },
      },
    },
    {
      slug: "complex-vector-space",
      routeSlugs: { en: "complex-vector-space", id: "ruang-vektor-kompleks" },
      translations: {
        en: {
          title: "Complex Vector Space",
        },
        id: {
          title: "Ruang Vektor Kompleks",
        },
      },
    },
    {
      slug: "cramer-rule",
      routeSlugs: { en: "cramer-rule", id: "aturan-cramer" },
      translations: {
        en: {
          title: "Cramer's Rule",
        },
        id: {
          title: "Aturan Cramer",
        },
      },
    },
    {
      slug: "determinant",
      routeSlugs: { en: "determinant", id: "definisi-determinan" },
      translations: {
        en: {
          title: "Definition of Determinant",
        },
        id: {
          title: "Definisi Determinan",
        },
      },
    },
    {
      slug: "determinant-calculation",
      routeSlugs: {
        en: "determinant-calculation",
        id: "perhitungan-determinan",
      },
      translations: {
        en: {
          title: "Determinant Calculation",
        },
        id: {
          title: "Perhitungan Determinan",
        },
      },
    },
    {
      slug: "diagonalization-matrix",
      routeSlugs: { en: "diagonalization-matrix", id: "diagonalisasi-matriks" },
      translations: {
        en: {
          title: "Matrix Diagonalization",
        },
        id: {
          title: "Diagonalisasi Matriks",
        },
      },
    },
    {
      slug: "diagonalization-procedure",
      routeSlugs: {
        en: "diagonalization-procedure",
        id: "prosedur-dasar-untuk-diagonalisasi",
      },
      translations: {
        en: {
          title: "Basic Procedure for Diagonalization",
        },
        id: {
          title: "Prosedur Dasar untuk Diagonalisasi",
        },
      },
    },
    {
      slug: "eigenvalue-diagonal-matrix",
      routeSlugs: {
        en: "eigenvalue-diagonal-matrix",
        id: "nilai-eigen-dari-matriks-diagonal-dan-segitiga",
      },
      translations: {
        en: {
          title: "Eigenvalues of Diagonal and Triangular Matrices",
        },
        id: {
          title: "Nilai Eigen dari Matriks Diagonal dan Segitiga",
        },
      },
    },
    {
      slug: "eigenvalue-eigenvector-eigenspace",
      routeSlugs: {
        en: "eigenvalue-eigenvector-eigenspace",
        id: "nilai-eigen-vektor-eigen-dan-ruang-eigen",
      },
      translations: {
        en: {
          title: "Eigenvalues, Eigenvectors, and Eigenspaces",
        },
        id: {
          title: "Nilai Eigen, Vektor Eigen, dan Ruang Eigen",
        },
      },
    },
    {
      slug: "identifiability-ranking",
      routeSlugs: {
        en: "identifiability-ranking",
        id: "kemampuan-identifikasi-dan-pemeringkatan",
      },
      translations: {
        en: {
          title: "Identifiability and Ranking Capability",
        },
        id: {
          title: "Kemampuan Identifikasi dan Pemeringkatan",
        },
      },
    },
    {
      slug: "individual-eigenvalue-calculation",
      routeSlugs: {
        en: "individual-eigenvalue-calculation",
        id: "perhitungan-nilai-eigen-individu",
      },
      translations: {
        en: {
          title: "Individual Eigenvalue Calculation",
        },
        id: {
          title: "Perhitungan Nilai Eigen Individu",
        },
      },
    },
    {
      slug: "jordan-normal-form",
      routeSlugs: {
        en: "jordan-normal-form",
        id: "trigonalisasi-dan-bentuk-normal-jordan",
      },
      translations: {
        en: {
          title: "Triangularization and Jordan Normal Form",
        },
        id: {
          title: "Trigonalisasi dan Bentuk Normal Jordan",
        },
      },
    },
    {
      slug: "laplace-expansion",
      routeSlugs: {
        en: "laplace-expansion",
        id: "teorema-pengembangan-laplace",
      },
      translations: {
        en: {
          title: "Laplace Expansion Theorem",
        },
        id: {
          title: "Teorema Pengembangan Laplace",
        },
      },
    },
    {
      slug: "linear-equilibrium-problem",
      routeSlugs: {
        en: "linear-equilibrium-problem",
        id: "masalah-keseimbangan-linear",
      },
      translations: {
        en: {
          title: "Linear Equilibrium Problem",
        },
        id: {
          title: "Masalah Keseimbangan Linear",
        },
      },
    },
    {
      slug: "linear-model",
      routeSlugs: { en: "linear-model", id: "linear-model" },
      translations: {
        en: {
          title: "Linear Model",
        },
        id: {
          title: "Linear Model",
        },
      },
    },
    {
      slug: "lu-decomposition",
      routeSlugs: { en: "lu-decomposition", id: "lu-dekomposisi" },
      translations: {
        en: {
          title: "LU Decomposition",
        },
        id: {
          title: "LU Dekomposisi",
        },
      },
    },
    {
      slug: "matrix-condition",
      routeSlugs: { en: "matrix-condition", id: "kondisi-matriks" },
      translations: {
        en: {
          title: "Matrix Condition",
        },
        id: {
          title: "Kondisi Matriks",
        },
      },
    },
    {
      slug: "matrix-similarity",
      routeSlugs: { en: "matrix-similarity", id: "kesamaan-matriks" },
      translations: {
        en: {
          title: "Matrix Similarity",
        },
        id: {
          title: "Kesamaan Matriks",
        },
      },
    },
    {
      slug: "normal-equation",
      routeSlugs: { en: "normal-equation", id: "sistem-persamaan-normal" },
      translations: {
        en: {
          title: "Normal Equation System",
        },
        id: {
          title: "Sistem Persamaan Normal",
        },
      },
    },
    {
      slug: "normal-equation-solution",
      routeSlugs: {
        en: "normal-equation-solution",
        id: "solusi-sistem-persamaan-normal",
      },
      translations: {
        en: {
          title: "Normal Equation System Solution",
        },
        id: {
          title: "Solusi Sistem Persamaan Normal",
        },
      },
    },
    {
      slug: "numerical-eigenvalue-calculation",
      routeSlugs: {
        en: "numerical-eigenvalue-calculation",
        id: "perhitungan-numerik-dari-nilai-eigen",
      },
      translations: {
        en: {
          title: "Numerical Calculation of Eigenvalues",
        },
        id: {
          title: "Perhitungan Numerik dari Nilai Eigen",
        },
      },
    },
    {
      slug: "orthogonal-polynomials",
      routeSlugs: { en: "orthogonal-polynomials", id: "polinomial-ortogonal" },
      translations: {
        en: {
          title: "Orthogonal Polynomials",
        },
        id: {
          title: "Polinomial Ortogonal",
        },
      },
    },
    {
      slug: "orthogonal-projection",
      routeSlugs: { en: "orthogonal-projection", id: "proyeksi-ortogonal" },
      translations: {
        en: {
          title: "Orthogonal Projection",
        },
        id: {
          title: "Proyeksi Ortogonal",
        },
      },
    },
    {
      slug: "orthogonal-unitary-matrix",
      routeSlugs: {
        en: "orthogonal-unitary-matrix",
        id: "matriks-ortogonal-dan-uniter",
      },
      translations: {
        en: {
          title: "Orthogonal and Unitary Matrices",
        },
        id: {
          title: "Matriks Ortogonal dan Uniter",
        },
      },
    },
    {
      slug: "positive-definite-matrix",
      routeSlugs: {
        en: "positive-definite-matrix",
        id: "matriks-definit-positif",
      },
      translations: {
        en: {
          title: "Positive Definite Matrix",
        },
        id: {
          title: "Matriks Definit Positif",
        },
      },
    },
    {
      slug: "principal-component-analysis",
      routeSlugs: {
        en: "principal-component-analysis",
        id: "analisis-komponen-utama",
      },
      translations: {
        en: {
          title: "Principal Component Analysis",
        },
        id: {
          title: "Analisis Komponen Utama",
        },
      },
    },
    {
      slug: "qr-decomposition",
      routeSlugs: { en: "qr-decomposition", id: "qr-dekomposisi" },
      translations: {
        en: {
          title: "QR Decomposition",
        },
        id: {
          title: "QR Dekomposisi",
        },
      },
    },
    {
      slug: "real-axis-transformation",
      routeSlugs: {
        en: "real-axis-transformation",
        id: "transformasi-sumbu-nyata",
      },
      translations: {
        en: {
          title: "Real Axis Transformation",
        },
        id: {
          title: "Transformasi Sumbu Nyata",
        },
      },
    },
    {
      slug: "regularization",
      routeSlugs: { en: "regularization", id: "regularisasi" },
      translations: {
        en: {
          title: "Regularization",
        },
        id: {
          title: "Regularisasi",
        },
      },
    },
    {
      slug: "scalar-product",
      routeSlugs: { en: "scalar-product", id: "produk-skalar" },
      translations: {
        en: {
          title: "Scalar Product",
        },
        id: {
          title: "Produk Skalar",
        },
      },
    },
    {
      slug: "spectral-complex-matrix",
      routeSlugs: {
        en: "spectral-complex-matrix",
        id: "teorema-spektral-untuk-matriks-kompleks",
      },
      translations: {
        en: {
          title: "Spectral Theorem for Complex Matrices",
        },
        id: {
          title: "Teorema Spektral untuk Matriks Kompleks",
        },
      },
    },
    {
      slug: "spectral-real-matrix",
      routeSlugs: {
        en: "spectral-real-matrix",
        id: "teorema-spektral-untuk-matriks-nyata",
      },
      translations: {
        en: {
          title: "Spectral Theorem for Real Matrices",
        },
        id: {
          title: "Teorema Spektral untuk Matriks Nyata",
        },
      },
    },
    {
      slug: "spectral-theorem",
      routeSlugs: { en: "spectral-theorem", id: "teorema-spektral" },
      translations: {
        en: {
          title: "Spectral Theorem",
        },
        id: {
          title: "Teorema Spektral",
        },
      },
    },
    {
      slug: "statistical-analysis",
      routeSlugs: { en: "statistical-analysis", id: "analisis-statistik" },
      translations: {
        en: {
          title: "Statistical Analysis",
        },
        id: {
          title: "Analisis Statistik",
        },
      },
    },
    {
      slug: "symmetric-hermitian-matrix",
      routeSlugs: {
        en: "symmetric-hermitian-matrix",
        id: "matriks-simetris-dan-hermitian",
      },
      translations: {
        en: {
          title: "Symmetric and Hermitian Matrices",
        },
        id: {
          title: "Matriks Simetris dan Hermitian",
        },
      },
    },
    {
      slug: "system-linear-equation",
      routeSlugs: {
        en: "system-linear-equation",
        id: "sistem-persamaan-linear",
      },
      translations: {
        en: {
          title: "System of Linear Equations",
        },
        id: {
          title: "Sistem Persamaan Linear",
        },
      },
    },
  ],
});
