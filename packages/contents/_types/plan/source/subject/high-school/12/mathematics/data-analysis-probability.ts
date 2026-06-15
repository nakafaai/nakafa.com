import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12MathematicsDataAnalysisProbabilityTopic =
  defineSubjectPlanTopic({
    slug: "data-analysis-probability",
    translations: {
      en: {
        description:
          "Statistical methods for processing information and predicting events under uncertainty.",
        title: "Data Analysis and Probability",
      },
      id: {
        description:
          "Metode statistik untuk mengolah informasi dan memprediksi kejadian dalam ketidakpastian.",
        title: "Analisis Data dan Peluang",
      },
    },
    sections: [
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
    ],
  });
