import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsQuadraticFunctionMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/quadratic-function",
  domain: "mathematics",
  key: "lesson.mathematics.quadratic-function",
  kind: "lesson",
  slug: "quadratic-function",
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
