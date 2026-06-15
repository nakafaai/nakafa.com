import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11ChemistryKineticChemistryTopic =
  defineSubjectMaterialTopic({
    slug: "kinetic-chemistry",
    translations: {
      en: {
        description:
          "Revealing reaction speeds to optimize industrial production and pharmaceuticals.",
        title: "Chemical Kinetics",
      },
      id: {
        description:
          "Mengungkap kecepatan reaksi untuk mengoptimalkan produksi industri dan obat-obatan.",
        title: "Kinetika Kimia",
      },
    },
    sections: [
      {
        slug: "collision-theory",
        translations: {
          en: {
            title: "Collision Theory",
          },
          id: {
            title: "Teori Tumbukan",
          },
        },
      },
      {
        slug: "reaction-rate",
        translations: {
          en: {
            title: "Reaction Rate",
          },
          id: {
            title: "Laju Reaksi",
          },
        },
      },
      {
        slug: "reaction-rate-equation-order",
        translations: {
          en: {
            title: "Rate Equations and Reaction Order",
          },
          id: {
            title: "Persamaan Laju Reaksi dan Orde Reaksi",
          },
        },
      },
      {
        slug: "factors-affecting-reaction-rate",
        translations: {
          en: {
            title: "Factors Affecting Reaction Rate",
          },
          id: {
            title: "Faktor-Faktor yang Mempengaruhi Laju Reaksi",
          },
        },
      },
    ],
  });
