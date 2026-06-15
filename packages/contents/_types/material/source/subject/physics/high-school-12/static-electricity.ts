import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool12PhysicsStaticElectricityTopic =
  defineSubjectMaterialTopic({
    slug: "static-electricity",
    translations: {
      en: {
        description:
          "Invisible force that makes hair stand up and enables touchscreen technology to work.",
        title: "Static Electricity",
      },
      id: {
        description:
          "Kekuatan tak terlihat yang membuat rambut berdiri dan memungkinkan teknologi touchscreen bekerja.",
        title: "Listrik Statis",
      },
    },
    sections: [
      {
        slug: "electric-force",
        translations: {
          en: {
            title: "Electric Force",
          },
          id: {
            title: "Gaya Listrik",
          },
        },
      },
      {
        slug: "coulomb-law",
        translations: {
          en: {
            title: "Coulomb's Law",
          },
          id: {
            title: "Hukum Coulomb",
          },
        },
      },
      {
        slug: "resultant-force",
        translations: {
          en: {
            title: "Resultant Force",
          },
          id: {
            title: "Resultan Gaya",
          },
        },
      },
      {
        slug: "point-charge-electric-field",
        translations: {
          en: {
            title: "Point Charge Electric Field",
          },
          id: {
            title: "Medan Listrik Muatan Titik",
          },
        },
      },
      {
        slug: "parallel-plate-electric-field",
        translations: {
          en: {
            title: "Parallel Plate Electric Field",
          },
          id: {
            title: "Medan Listrik pada Pelat Paralel",
          },
        },
      },
      {
        slug: "parallel-plate-capacitor",
        translations: {
          en: {
            title: "Parallel Plate Capacitor",
          },
          id: {
            title: "Kapasitor Keping Sejajar",
          },
        },
      },
      {
        slug: "capacitor-circuit",
        translations: {
          en: {
            title: "Capacitor Circuit",
          },
          id: {
            title: "Rangkaian Kapasitor",
          },
        },
      },
      {
        slug: "series-circuit",
        translations: {
          en: {
            title: "Series Circuit",
          },
          id: {
            title: "Rangkaian Seri",
          },
        },
      },
      {
        slug: "parallel-circuit",
        translations: {
          en: {
            title: "Parallel Circuit",
          },
          id: {
            title: "Rangkaian Paralel",
          },
        },
      },
    ],
  });
