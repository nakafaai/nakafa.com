import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool12PhysicsDirectCurrentTopic =
  defineSubjectMaterialTopic({
    slug: "direct-current",
    translations: {
      en: {
        description:
          "Foundation of all electronic devices from smartphones to electric cars changing the world.",
        title: "Direct Current",
      },
      id: {
        description:
          "Dasar semua perangkat elektronik dari smartphone hingga mobil listrik yang mengubah dunia.",
        title: "Listrik Arus Searah",
      },
    },
    sections: [
      {
        slug: "electric-current",
        translations: {
          en: {
            title: "Electric Current",
          },
          id: {
            title: "Arus Listrik",
          },
        },
      },
      {
        slug: "ohmic-non-ohmic-resistance",
        translations: {
          en: {
            title: "Ohmic and Non-Ohmic Resistance",
          },
          id: {
            title: "Hambatan Ohmik dan Non Ohmik",
          },
        },
      },
      {
        slug: "resistivity",
        translations: {
          en: {
            title: "Resistivity",
          },
          id: {
            title: "Hambatan Jenis",
          },
        },
      },
      {
        slug: "electric-circuit",
        translations: {
          en: {
            title: "Electric Circuit",
          },
          id: {
            title: "Rangkaian Listrik",
          },
        },
      },
      {
        slug: "compound-circuit",
        translations: {
          en: {
            title: "Compound Circuit",
          },
          id: {
            title: "Rangkaian Majemuk",
          },
        },
      },
      {
        slug: "electric-power",
        translations: {
          en: {
            title: "Electric Power",
          },
          id: {
            title: "Daya Listrik",
          },
        },
      },
    ],
  });
