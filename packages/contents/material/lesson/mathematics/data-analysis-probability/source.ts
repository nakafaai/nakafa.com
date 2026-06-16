import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsDataAnalysisProbabilityMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/data-analysis-probability",
    domain: "mathematics",
    key: "lesson.mathematics.data-analysis-probability",
    kind: "lesson",
    slug: "data-analysis-probability",
    translations: {
      en: {
        description:
          "Learn binomial distribution formula with worked examples. Calculate probability of success in repeated trials with coin flips and practice problems.",
        title: "Data Analysis and Probability",
      },
      id: {
        description:
          "Pelajari rumus distribusi binomial untuk menghitung peluang keberhasilan dalam percobaan berulang dan latihan soal.",
        title: "Analisis Data dan Peluang",
      },
    },
    sections: [
      {
        slug: "binomial-distribution-function",
        translations: {
          en: {
            title: "Binomial Distribution Function",
          },
          id: {
            title: "Fungsi Distribusi Binomial",
          },
        },
      },
      {
        slug: "expected-value-of-binomial-distribution",
        translations: {
          en: {
            title: "Expected Value of Binomial Distribution",
          },
          id: {
            title: "Nilai Harapan Distribusi Binomial",
          },
        },
      },
      {
        slug: "expected-value-of-normal-distribution",
        translations: {
          en: {
            title: "Expected Value of Normal Distribution",
          },
          id: {
            title: "Nilai Harapan Distribusi Normal",
          },
        },
      },
      {
        slug: "normal-distribution-function",
        translations: {
          en: {
            title: "Normal Distribution Function",
          },
          id: {
            title: "Fungsi Distribusi Normal",
          },
        },
      },
      {
        slug: "uniform-distribution",
        translations: {
          en: {
            title: "Uniform Distribution",
          },
          id: {
            title: "Distribusi Seragam",
          },
        },
      },
    ],
  });
