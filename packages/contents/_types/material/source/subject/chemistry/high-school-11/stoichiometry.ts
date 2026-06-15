import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11ChemistryStoichiometryTopic =
  defineSubjectMaterialTopic({
    slug: "stoichiometry",
    translations: {
      en: {
        description:
          "Chemistry mathematics enabling accurate predictions in drug and food production.",
        title: "Stoichiometry",
      },
      id: {
        description:
          "Matematika kimia yang memungkinkan prediksi akurat dalam pembuatan obat dan makanan.",
        title: "Stoikiometri",
      },
    },
    sections: [
      {
        slug: "definition",
        translations: {
          en: {
            title: "Definition of Stoichiometry",
          },
          id: {
            title: "Pengertian Stoikiometri",
          },
        },
      },
      {
        slug: "mol-concept",
        translations: {
          en: {
            title: "Mole Concept",
          },
          id: {
            title: "Konsep Mol",
          },
        },
      },
      {
        slug: "molecular-empirical-formula",
        translations: {
          en: {
            title: "Molecular and Empirical Formulas",
          },
          id: {
            title: "Rumus Molekul dan Rumus Empiris",
          },
        },
      },
      {
        slug: "limiting-reagent",
        translations: {
          en: {
            title: "Limiting Reagent",
          },
          id: {
            title: "Pereaksi Pembatas",
          },
        },
      },
      {
        slug: "percentage-yield",
        translations: {
          en: {
            title: "Percentage Yield",
          },
          id: {
            title: "Persen Hasil",
          },
        },
      },
      {
        slug: "percentage-purity",
        translations: {
          en: {
            title: "Percentage Purity",
          },
          id: {
            title: "Persen Kemurnian",
          },
        },
      },
    ],
  });
