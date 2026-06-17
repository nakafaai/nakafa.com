import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsDataAnalysisProbabilityMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/data-analysis-probability",
    domain: "mathematics",
    key: "lesson.mathematics.data-analysis-probability",
    kind: "lesson",
    slug: "data-analysis-probability",
    routeSlugs: {
      en: "data-analysis-probability",
      id: "analisis-data-dan-peluang",
    },
    translations: {
      en: {
        description: "Model repeated success with binomial probabilities.",
        title: "Data Analysis and Probability",
      },
      id: {
        description: "Modelkan keberhasilan berulang dengan peluang binomial.",
        title: "Analisis Data dan Peluang",
      },
    },
    sections: [
      {
        slug: "binomial-distribution-function",
        routeSlugs: {
          en: "binomial-distribution-function",
          id: "fungsi-distribusi-binomial",
        },
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
        routeSlugs: {
          en: "expected-value-of-binomial-distribution",
          id: "nilai-harapan-distribusi-binomial",
        },
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
        routeSlugs: {
          en: "expected-value-of-normal-distribution",
          id: "nilai-harapan-distribusi-normal",
        },
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
        routeSlugs: {
          en: "normal-distribution-function",
          id: "fungsi-distribusi-normal",
        },
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
        routeSlugs: { en: "uniform-distribution", id: "distribusi-seragam" },
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
