import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11ChemistryThermochemistryTopic =
  defineSubjectPlanTopic({
    slug: "thermochemistry",
    translations: {
      en: {
        description:
          "Study of energy in chemical reactions explaining why wood burns and ice melts.",
        title: "Thermochemistry",
      },
      id: {
        description:
          "Studi energi dalam reaksi kimia yang menjelaskan mengapa kayu terbakar dan es mencair.",
        title: "Termokimia",
      },
    },
    sections: [
      {
        slug: "law-conservation-energy",
        translations: {
          en: {
            title: "Law of Conservation of Energy",
          },
          id: {
            title: "Hukum Kekekalan Energi",
          },
        },
      },
      {
        slug: "system-environment",
        translations: {
          en: {
            title: "System and Environment",
          },
          id: {
            title: "Sistem dan Lingkungan",
          },
        },
      },
      {
        slug: "exothermic-endothermic-reactions",
        translations: {
          en: {
            title: "Exothermic and Endothermic Reactions",
          },
          id: {
            title: "Reaksi Eksotermik dan Endotermik",
          },
        },
      },
      {
        slug: "calorimetry",
        translations: {
          en: {
            title: "Calorimetry",
          },
          id: {
            title: "Kalorimetri",
          },
        },
      },
      {
        slug: "enthalpy-enthalpy-change",
        translations: {
          en: {
            title: "Enthalpy and Enthalpy Change",
          },
          id: {
            title: "Entalpi dan Perubahan Entalpi",
          },
        },
      },
      {
        slug: "thermochemical-equation",
        translations: {
          en: {
            title: "Thermochemical Equations",
          },
          id: {
            title: "Persamaan Termokimia",
          },
        },
      },
      {
        slug: "enthalpy-standard-state",
        translations: {
          en: {
            title: "Enthalpy Change in Standard State",
          },
          id: {
            title: "Perubahan Entalpi dalam Keadaan Standar",
          },
        },
      },
      {
        slug: "hess-law",
        translations: {
          en: {
            title: "Hess's Law",
          },
          id: {
            title: "Hukum Hess",
          },
        },
      },
      {
        slug: "bond-energy",
        translations: {
          en: {
            title: "Bond Energy",
          },
          id: {
            title: "Energi Ikatan",
          },
        },
      },
    ],
  });
