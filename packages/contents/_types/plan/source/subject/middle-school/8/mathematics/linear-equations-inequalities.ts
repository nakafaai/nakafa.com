import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectMiddleSchool8MathematicsLinearEquationsInequalitiesTopic =
  defineSubjectPlanTopic({
    slug: "linear-equations-inequalities",
    translations: {
      en: {
        description:
          "Build open sentences, equations, and one-variable inequalities through complete solving steps.",
        title: "Linear Equations and Inequalities of One Variable",
      },
      id: {
        description:
          "Menyusun kalimat terbuka, persamaan, dan pertidaksamaan satu variabel sampai selesai.",
        title: "Persamaan dan Pertidaksamaan Linier Satu Variabel",
      },
    },
    sections: [
      {
        slug: "equation-concept",
        translations: {
          en: {
            title: "Concept of Linear Equations",
          },
          id: {
            title: "Konsep Persamaan Linier Satu Variabel",
          },
        },
      },
      {
        slug: "open-closed",
        translations: {
          en: {
            title: "Open and Closed Sentences",
          },
          id: {
            title: "Menentukan Kalimat Terbuka dan Tertutup",
          },
        },
      },
      {
        slug: "general-form",
        translations: {
          en: {
            title: "General Form of Linear Equations",
          },
          id: {
            title: "Menemukan bentuk umum dari Persamaan Linier Satu Variabel",
          },
        },
      },
      {
        slug: "solving-equations",
        translations: {
          en: {
            title: "Solving Linear Equations",
          },
          id: {
            title: "Menyelesaikan Persamaan Linier Satu Variabel",
          },
        },
      },
      {
        slug: "inequality-concept",
        translations: {
          en: {
            title: "Concept of Linear Inequalities",
          },
          id: {
            title: "Menemukan Konsep Pertidaksamaan Linier Satu Variabel",
          },
        },
      },
      {
        slug: "solving-inequalities",
        translations: {
          en: {
            title: "Solving Linear Inequalities Problems",
          },
          id: {
            title:
              "Menyelesaikan Masalah terkait Pertidaksamaan Linier Satu Variabel",
          },
        },
      },
    ],
  });
