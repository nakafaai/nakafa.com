import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11ChemistryChemicalEquilibriumTopic =
  defineSubjectMaterialTopic({
    slug: "chemical-equilibrium",
    translations: {
      en: {
        description:
          "Dynamic harmony in reactions enabling precise control in chemical synthesis.",
        title: "Chemical Equilibrium",
      },
      id: {
        description:
          "Harmoni dinamis dalam reaksi yang memungkinkan kontrol presisi dalam sintesis kimia.",
        title: "Kesetimbangan Kimia",
      },
    },
    sections: [
      {
        slug: "concept",
        translations: {
          en: {
            title: "Chemical Equilibrium Concept",
          },
          id: {
            title: "Konsep Kesetimbangan Kimia",
          },
        },
      },
      {
        slug: "equilibrium-constant",
        translations: {
          en: {
            title: "Equilibrium Constant",
          },
          id: {
            title: "Tetapan Kesetimbangan",
          },
        },
      },
      {
        slug: "equilibrium-constant-calculations",
        translations: {
          en: {
            title: "Using Equilibrium Constants in Calculations",
          },
          id: {
            title: "Menggunakan Tetapan Kesetimbangan dalam Perhitungan",
          },
        },
      },
      {
        slug: "equilibrium-shift",
        translations: {
          en: {
            title: "Equilibrium Shift",
          },
          id: {
            title: "Pergeseran Kesetimbangan",
          },
        },
      },
      {
        slug: "industrial-applications",
        translations: {
          en: {
            title: "Chemical Equilibrium in Industry",
          },
          id: {
            title: "Kesetimbangan Kimia dalam Industri",
          },
        },
      },
    ],
  });
