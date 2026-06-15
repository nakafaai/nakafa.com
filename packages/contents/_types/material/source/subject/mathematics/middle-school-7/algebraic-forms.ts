import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectMiddleSchool7MathematicsAlgebraicFormsTopic =
  defineSubjectMaterialTopic({
    slug: "algebraic-forms",
    translations: {
      en: {
        description:
          "Turn situations into variables, terms, operations, and simple algebraic models.",
        title: "Algebraic Forms",
      },
      id: {
        description:
          "Mengubah situasi menjadi variabel, suku, operasi, dan model aljabar sederhana.",
        title: "Bentuk Aljabar",
      },
    },
    sections: [
      {
        slug: "algebraic-elements",
        translations: {
          en: {
            title: "Algebraic Elements",
          },
          id: {
            title: "Unsur-Untuk Bentuk Aljabar",
          },
        },
      },
      {
        slug: "algebraic-properties",
        translations: {
          en: {
            title: "Algebraic Properties",
          },
          id: {
            title: "Sifat-Sifat Aljabar",
          },
        },
      },
      {
        slug: "algebraic-operations",
        translations: {
          en: {
            title: "Algebraic Operations",
          },
          id: {
            title: "Operasi Aljabar",
          },
        },
      },
      {
        slug: "algebraic-modeling",
        translations: {
          en: {
            title: "Algebraic Modeling",
          },
          id: {
            title: "Pemodelan dalam Bentuk Aljabar",
          },
        },
      },
    ],
  });
