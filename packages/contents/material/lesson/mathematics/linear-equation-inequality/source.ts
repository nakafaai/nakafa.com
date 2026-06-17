import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsLinearEquationInequalityMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/linear-equation-inequality",
    domain: "mathematics",
    key: "lesson.mathematics.linear-equation-inequality",
    kind: "lesson",
    slug: "linear-equation-inequality",
    routeSlugs: {
      en: "linear-equation-inequality",
      id: "sistem-persamaan-dan-pertidaksamaan-linear",
    },
    translations: {
      en: {
        description:
          "Learn solving linear equation systems with substitution and elimination methods. Learn real-world applications with worked examples and visual guides.",
        title: "Systems of Linear Equations and Inequalities",
      },
      id: {
        description:
          "Pelajari cara menyelesaikan sistem persamaan linear dengan metode substitusi dan eliminasi melalui contoh aplikasi dan panduan visual.",
        title: "Sistem Persamaan dan Pertidaksamaan Linear",
      },
    },
    sections: [
      {
        slug: "system-linear-equation",
        routeSlugs: {
          en: "system-linear-equation",
          id: "sistem-persamaan-linear",
        },
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
        routeSlugs: {
          en: "system-linear-inequality",
          id: "sistem-pertidaksamaan-linear",
        },
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
