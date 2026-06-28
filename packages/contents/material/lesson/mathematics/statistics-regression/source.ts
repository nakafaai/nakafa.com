import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsStatisticsRegressionMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/statistics-regression",
    domain: "mathematics",
    key: "lesson.mathematics.statistics-regression",
    kind: "lesson",
    slug: "statistics-regression",
    routeSlugs: { en: "statistics-regression", id: "regresi-statistik" },
    translations: {
      en: {
        description: "Read how r² shows variation explained by a model.",
        title: "Statistics",
      },
      id: {
        description: "Baca r² sebagai ukuran variasi yang terjelaskan.",
        title: "Statistika",
      },
    },
    sections: [
      {
        slug: "coefficient-of-determination",
        routeSlugs: {
          en: "coefficient-of-determination",
          id: "koefisien-determinasi",
        },
        translations: {
          en: {
            title: "Coefficient of Determination",
          },
          id: {
            title: "Koefisien Determinasi",
          },
        },
      },
      {
        slug: "correlation-analysis-concept",
        routeSlugs: {
          en: "correlation-analysis-concept",
          id: "konsep-analisis-korelasi",
        },
        translations: {
          en: {
            title: "Correlation Analysis Concept",
          },
          id: {
            title: "Konsep Analisis Korelasi",
          },
        },
      },
      {
        slug: "least-squares-method",
        routeSlugs: {
          en: "least-squares-method",
          id: "metode-kuadrat-terkecil",
        },
        translations: {
          en: {
            title: "Least Squares Method",
          },
          id: {
            title: "Metode Kuadrat Terkecil",
          },
        },
      },
      {
        slug: "linear-regression-concept",
        routeSlugs: {
          en: "linear-regression-concept",
          id: "konsep-regresi-linear",
        },
        translations: {
          en: {
            title: "Linear Regression Concept",
          },
          id: {
            title: "Konsep Regresi Linear",
          },
        },
      },
      {
        slug: "product-moment-correlation",
        routeSlugs: {
          en: "product-moment-correlation",
          id: "korelasi-product-moment",
        },
        translations: {
          en: {
            title: "Product Moment Correlation",
          },
          id: {
            title: "Korelasi Product Moment",
          },
        },
      },
      {
        slug: "scatter-diagram",
        routeSlugs: {
          en: "scatter-diagram",
          id: "diagram-pencar-atau-diagram-scatter",
        },
        translations: {
          en: {
            title: "Scatter Diagram",
          },
          id: {
            title: "Diagram Pencar atau Diagram Scatter",
          },
        },
      },
    ],
  });
