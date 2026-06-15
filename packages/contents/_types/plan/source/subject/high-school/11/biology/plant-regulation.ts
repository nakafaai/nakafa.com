import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11BiologyPlantRegulationTopic =
  defineSubjectPlanTopic({
    slug: "plant-regulation",
    translations: {
      en: {
        description:
          "Complex systems enabling plants to grow, reproduce, and adapt.",
        title: "Regulation Processes in Plants",
      },
      id: {
        description:
          "Sistem kompleks yang memungkinkan tumbuhan tumbuh, bereproduksi, dan beradaptasi.",
        title: "Proses Pengaturan pada Tumbuhan",
      },
    },
    sections: [
      {
        slug: "tissue",
        translations: {
          en: {
            title: "Tissues",
          },
          id: {
            title: "Jaringan",
          },
        },
      },
      {
        slug: "organ",
        translations: {
          en: {
            title: "Organs",
          },
          id: {
            title: "Organ",
          },
        },
      },
      {
        slug: "organ-system",
        translations: {
          en: {
            title: "Organ Systems",
          },
          id: {
            title: "Sistem Organ",
          },
        },
      },
      {
        slug: "transport",
        translations: {
          en: {
            title: "Transport in Plants",
          },
          id: {
            title: "Transpor pada Tumbuhan",
          },
        },
      },
      {
        slug: "reproduction",
        translations: {
          en: {
            title: "Plant Reproduction",
          },
          id: {
            title: "Reproduksi pada Tumbuhan",
          },
        },
      },
      {
        slug: "irritability",
        translations: {
          en: {
            title: "Plant Irritability",
          },
          id: {
            title: "Iritabilitas pada Tumbuhan",
          },
        },
      },
    ],
  });
