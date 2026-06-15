import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool10MathematicsLinearEquationInequalityTopic =
  defineSubjectPlanTopic({
    slug: "linear-equation-inequality",
    translations: {
      en: {
        description:
          "The key to optimizing business and solving real-world problems.",
        title: "Systems of Linear Equations and Inequalities",
      },
      id: {
        description:
          "Kunci untuk mengoptimalkan bisnis dan menyelesaikan masalah nyata.",
        title: "Sistem Persamaan dan Pertidaksamaan Linear",
      },
    },
    sections: [
      {
        slug: "system-linear-equation",
        translations: {
          en: {
            title: "Linear Equation Systems",
          },
          id: {
            title: "Sistem Persamaan Linear",
          },
        },
      },
      {
        slug: "system-linear-inequality",
        translations: {
          en: {
            title: "Linear Inequality Systems",
          },
          id: {
            title: "Sistem Pertidaksamaan Linear",
          },
        },
      },
    ],
  });
