import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11ChemistryChemicalBondingTopic =
  defineSubjectPlanTopic({
    slug: "chemical-bonding",
    translations: {
      en: {
        description:
          "Hidden forces that unite atoms creating everything from water to diamonds.",
        title: "Chemical Bonding",
      },
      id: {
        description:
          "Kekuatan tersembunyi yang menyatukan atom menciptakan segalanya dari air hingga berlian.",
        title: "Ikatan Kimia",
      },
    },
    sections: [
      {
        slug: "basic-chemical-bonding",
        translations: {
          en: {
            title: "Basics of Chemical Bonding",
          },
          id: {
            title: "Dasar Ikatan Kimia",
          },
        },
      },
      {
        slug: "ionic-bonding",
        translations: {
          en: {
            title: "Ionic Bonding",
          },
          id: {
            title: "Ikatan Ion",
          },
        },
      },
      {
        slug: "covalent-bonding",
        translations: {
          en: {
            title: "Covalent Bonding",
          },
          id: {
            title: "Ikatan Kovalen",
          },
        },
      },
      {
        slug: "metallic-bonding",
        translations: {
          en: {
            title: "Metallic Bonding",
          },
          id: {
            title: "Ikatan Logam",
          },
        },
      },
      {
        slug: "molecular-shape",
        translations: {
          en: {
            title: "Molecular Shape",
          },
          id: {
            title: "Bentuk Molekul",
          },
        },
      },
      {
        slug: "intermolecular-bonding",
        translations: {
          en: {
            title: "Intermolecular Bonding",
          },
          id: {
            title: "Ikatan Antar Molekul",
          },
        },
      },
    ],
  });
