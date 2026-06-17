import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsQuadraticFunctionMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/quadratic-function",
  domain: "mathematics",
  key: "lesson.mathematics.quadratic-function",
  kind: "lesson",
  slug: "quadratic-function",
  routeSlugs: { en: "quadratic-function", id: "persamaan-dan-fungsi-kuadrat" },
  translations: {
    en: {
      description:
        "Learn how to solve quadratic equations with factorization, completing the square, and the quadratic formula through examples and practice questions.",
      title: "Quadratic Functions",
    },
    id: {
      description:
        "Pelajari cara menyelesaikan persamaan kuadrat dengan faktorisasi, melengkapkan kuadrat, dan rumus kuadrat melalui contoh dan soal praktis.",
      title: "Persamaan dan Fungsi Kuadrat",
    },
  },
  sections: [
    {
      slug: "quadratic-equation",
      routeSlugs: { en: "quadratic-equation", id: "persamaan-kuadrat" },
      translations: {
        en: {
          title: "Quadratic Equations",
        },
        id: {
          title: "Persamaan Kuadrat",
        },
      },
    },
    {
      slug: "quadratic-equation-factorization",
      routeSlugs: {
        en: "quadratic-equation-factorization",
        id: "faktorisasi-persamaan-kuadrat",
      },
      translations: {
        en: {
          title: "Quadratic Equation Factorization",
        },
        id: {
          title: "Faktorisasi Persamaan Kuadrat",
        },
      },
    },
    {
      slug: "quadratic-equation-formula",
      routeSlugs: {
        en: "quadratic-equation-formula",
        id: "rumus-persamaan-kuadrat",
      },
      translations: {
        en: {
          title: "Quadratic Formula",
        },
        id: {
          title: "Rumus Persamaan Kuadrat",
        },
      },
    },
    {
      slug: "quadratic-equation-imaginary-root",
      routeSlugs: {
        en: "quadratic-equation-imaginary-root",
        id: "akar-tidak-nyata-atau-imajiner",
      },
      translations: {
        en: {
          title: "Imaginary or Non-Real Roots",
        },
        id: {
          title: "Akar Tidak Nyata atau Imajiner",
        },
      },
    },
    {
      slug: "quadratic-equation-perfect-square",
      routeSlugs: {
        en: "quadratic-equation-perfect-square",
        id: "melengkapi-kuadrat-sempurna",
      },
      translations: {
        en: {
          title: "Completing the Square",
        },
        id: {
          title: "Melengkapi Kuadrat Sempurna",
        },
      },
    },
    {
      slug: "quadratic-equation-types-of-root",
      routeSlugs: {
        en: "quadratic-equation-types-of-root",
        id: "jenis-jenis-akar-persamaan-kuadrat",
      },
      translations: {
        en: {
          title: "Types of Quadratic Equation Roots",
        },
        id: {
          title: "Jenis-Jenis Akar Persamaan Kuadrat",
        },
      },
    },
    {
      slug: "quadratic-function-characteristics",
      routeSlugs: {
        en: "quadratic-function-characteristics",
        id: "karakteristik-fungsi-kuadrat",
      },
      translations: {
        en: {
          title: "Characteristics of Quadratic Functions",
        },
        id: {
          title: "Karakteristik Fungsi Kuadrat",
        },
      },
    },
    {
      slug: "quadratic-function-construction",
      routeSlugs: {
        en: "quadratic-function-construction",
        id: "mengonstruksi-fungsi-kuadrat",
      },
      translations: {
        en: {
          title: "Constructing Quadratic Functions",
        },
        id: {
          title: "Mengonstruksi Fungsi Kuadrat",
        },
      },
    },
    {
      slug: "quadratic-function-maximum-area",
      routeSlugs: {
        en: "quadratic-function-maximum-area",
        id: "menentukan-luas-maksimum",
      },
      translations: {
        en: {
          title: "Determining Maximum Area",
        },
        id: {
          title: "Menentukan Luas Maksimum",
        },
      },
    },
    {
      slug: "quadratic-function-minimum-area",
      routeSlugs: {
        en: "quadratic-function-minimum-area",
        id: "menentukan-luas-minimum",
      },
      translations: {
        en: {
          title: "Determining Minimum Area",
        },
        id: {
          title: "Menentukan Luas Minimum",
        },
      },
    },
  ],
});
