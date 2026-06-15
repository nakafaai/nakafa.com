import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11BiologyExploreCellTopic =
  defineSubjectMaterialTopic({
    slug: "explore-cell",
    translations: {
      en: {
        description:
          "Basic unit of life controlling all processes from metabolism to reproduction.",
        title: "Exploring Cells",
      },
      id: {
        description:
          "Unit dasar kehidupan yang mengendalikan semua proses dari metabolisme hingga reproduksi.",
        title: "Menjelajah Sel",
      },
    },
    sections: [
      {
        slug: "what-is-cell",
        translations: {
          en: {
            title: "What is a Cell?",
          },
          id: {
            title: "Apa itu Sel?",
          },
        },
      },
      {
        slug: "structure-cell",
        translations: {
          en: {
            title: "Cell Structure",
          },
          id: {
            title: "Struktur Sel",
          },
        },
      },
      {
        slug: "structure-function-relationship",
        translations: {
          en: {
            title: "Relationship between Cell Structure and Function",
          },
          id: {
            title: "Keterkaitan antara Struktur dan Fungsi Sel",
          },
        },
      },
      {
        slug: "composition-cell",
        translations: {
          en: {
            title: "Cell Composition",
          },
          id: {
            title: "Komposisi Sel",
          },
        },
      },
    ],
  });
