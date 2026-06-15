import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11BiologyGrowthDevelopmentTopic =
  defineSubjectPlanTopic({
    slug: "growth-development",
    translations: {
      en: {
        description:
          "Amazing process of organism transformation from birth to maturity.",
        title: "Growth and Development of Living Organisms",
      },
      id: {
        description:
          "Proses menakjubkan transformasi makhluk hidup dari lahir hingga dewasa.",
        title: "Tumbuh Kembang Makhluk Hidup",
      },
    },
    sections: [
      {
        slug: "growth-phenomena",
        translations: {
          en: {
            title: "Growth Phenomena",
          },
          id: {
            title: "Fenomena Pertumbuhan",
          },
        },
      },
      {
        slug: "development-phenomena",
        translations: {
          en: {
            title: "Development Phenomena",
          },
          id: {
            title: "Fenomena Perkembangan",
          },
        },
      },
      {
        slug: "growth-factors",
        translations: {
          en: {
            title: "Factors Affecting Growth",
          },
          id: {
            title: "Faktor yang Mempengaruhi Pertumbuhan",
          },
        },
      },
      {
        slug: "development-factors",
        translations: {
          en: {
            title: "Factors Affecting Development",
          },
          id: {
            title: "Faktor yang Mempengaruhi Perkembangan",
          },
        },
      },
    ],
  });
