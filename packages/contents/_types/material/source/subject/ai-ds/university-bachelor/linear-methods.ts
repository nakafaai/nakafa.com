import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectUniversityBachelorAiDsLinearMethodsTopic =
  defineSubjectMaterialTopic({
    slug: "linear-methods",
    translations: {
      en: {
        description:
          "Matrices, vectors, decompositions, and projections for reading data structure and building linear models.",
        title: "Linear Methods of AI",
      },
      id: {
        description:
          "Matriks, vektor, dekomposisi, dan proyeksi untuk membaca struktur data serta membangun model linear.",
        title: "Metode Linear AI",
      },
    },
    sections: [
      {
        slug: "determinant",
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
        slug: "laplace-expansion",
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
        slug: "cramer-rule",
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
        slug: "complex-vector-space",
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
        slug: "complex-matrix",
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
        slug: "eigenvalue-eigenvector-eigenspace",
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
        slug: "characteristic-polynomial",
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
        slug: "eigenvalue-diagonal-matrix",
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
        slug: "orthogonal-unitary-matrix",
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
        slug: "symmetric-hermitian-matrix",
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
        slug: "positive-definite-matrix",
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
        slug: "scalar-product",
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
        slug: "matrix-condition",
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
        slug: "lu-decomposition",
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
        slug: "cholesky-decomposition",
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
        slug: "qr-decomposition",
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
        slug: "linear-model",
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
        slug: "system-linear-equation",
        translations: {
          en: {
            title: "System of Linear Equations",
          },
          id: {
            title: "Sistem Persamaan Linear",
          },
        },
      },
      {
        slug: "linear-equilibrium-problem",
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
        slug: "normal-equation",
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
        slug: "identifiability-ranking",
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
        slug: "regularization",
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
        slug: "statistical-analysis",
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
        slug: "approximation-function-polynomial",
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
        slug: "orthogonal-projection",
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
        slug: "orthogonal-polynomials",
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
        slug: "matrix-similarity",
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
        slug: "diagonalization-matrix",
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
        slug: "spectral-theorem",
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
        slug: "spectral-complex-matrix",
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
        slug: "real-axis-transformation",
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
        slug: "principal-component-analysis",
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
        slug: "jordan-normal-form",
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
        slug: "numerical-eigenvalue-calculation",
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
        slug: "individual-eigenvalue-calculation",
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
        slug: "all-eigenvalues-calculation",
        translations: {
          en: {
            title: "All Eigenvalues Calculation",
          },
          id: {
            title: "Perhitungan Semua Nilai Eigen",
          },
        },
      },
    ],
  });
