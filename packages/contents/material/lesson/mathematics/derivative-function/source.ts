import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsDerivativeFunctionMaterial = defineLessonMaterial(
  {
    assetRoot: "material/lesson/mathematics/derivative-function",
    domain: "mathematics",
    key: "lesson.mathematics.derivative-function",
    kind: "lesson",
    slug: "derivative-function",
    translations: {
      en: {
        description:
          "Learn how derivatives solve real-world physics problems. Calculate velocity, acceleration, and maximum heights with worked examples and formulas.",
        title: "Derivative Functions",
      },
      id: {
        description:
          "Pelajari cara turunan memecahkan masalah fisika nyata. Hitung kecepatan, percepatan, dan ketinggian maksimum dengan contoh dan rumus bertahap.",
        title: "Turunan Fungsi",
      },
    },
    sections: [
      {
        slug: "application-of-derivative",
        translations: {
          en: {
            title: "Application of Derivatives",
          },
          id: {
            title: "Aplikasi Turunan",
          },
        },
      },
      {
        slug: "chain-rule-in-derivative",
        translations: {
          en: {
            title: "Chain Rule in Derivative",
          },
          id: {
            title: "Aturan Rantai pada Turunan",
          },
        },
      },
      {
        slug: "concept-of-derivative-function",
        translations: {
          en: {
            title: "Concept of Derivative Function",
          },
          id: {
            title: "Konsep Turunan Fungsi",
          },
        },
      },
      {
        slug: "derivative-of-algebraic-function",
        translations: {
          en: {
            title: "Derivative of Algebraic Function",
          },
          id: {
            title: "Turunan Fungsi Aljabar",
          },
        },
      },
      {
        slug: "derivative-of-trigonometric-function",
        translations: {
          en: {
            title: "Derivative of Trigonometric Function",
          },
          id: {
            title: "Turunan Fungsi Trigonometri",
          },
        },
      },
      {
        slug: "equation-of-a-tangent-line-to-a-curve",
        translations: {
          en: {
            title: "Equation of a Tangent Line to a Curve",
          },
          id: {
            title: "Persamaan Garis Singgung pada Kurva",
          },
        },
      },
      {
        slug: "extrema-maximum-and-minimum-value",
        translations: {
          en: {
            title: "Extreme Points, Maximum and Minimum Turning Points",
          },
          id: {
            title: "Titik Ekstrim, Nilai Balik Maksimum dan Minimum",
          },
        },
      },
      {
        slug: "increasing-decreasing-and-stationary-function",
        translations: {
          en: {
            title: "Increasing, Decreasing, and Stationary Functions",
          },
          id: {
            title: "Fungsi Naik, Turun, dan Stasioner",
          },
        },
      },
      {
        slug: "properties-of-derivative-function",
        translations: {
          en: {
            title: "Properties of Derivative Function",
          },
          id: {
            title: "Sifat Turunan Fungsi",
          },
        },
      },
      {
        slug: "writing-the-derivative-function",
        translations: {
          en: {
            title: "Writing the Derivative Function",
          },
          id: {
            title: "Penulisan Turunan Fungsi",
          },
        },
      },
    ],
  }
);
