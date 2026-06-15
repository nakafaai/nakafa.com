import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool10MathematicsProbabilityTopic =
  defineSubjectPlanTopic({
    slug: "probability",
    translations: {
      en: {
        description:
          "Mathematics of uncertainty behind AI, weather forecasting, and game strategy.",
        title: "Probability",
      },
      id: {
        description:
          "Matematika ketidakpastian di balik AI, prediksi cuaca, dan strategi game.",
        title: "Peluang",
      },
    },
    sections: [
      {
        slug: "probability-distribution",
        translations: {
          en: {
            title: "Probability Distribution",
          },
          id: {
            title: "Distribusi Peluang",
          },
        },
      },
      {
        slug: "addition-rule",
        translations: {
          en: {
            title: "Addition Rule",
          },
          id: {
            title: "Aturan Penjumlahan",
          },
        },
      },
      {
        slug: "two-events-mutually-exclusive",
        translations: {
          en: {
            title: "Mutually Exclusive Events A and B",
          },
          id: {
            title: "Dua Kejadian A dan B Saling Lepas",
          },
        },
      },
      {
        slug: "two-events-not-mutually-exclusive",
        translations: {
          en: {
            title: "Non-Mutually Exclusive Events A and B",
          },
          id: {
            title: "Dua Kejadian A dan B Tidak Saling Lepas",
          },
        },
      },
    ],
  });
