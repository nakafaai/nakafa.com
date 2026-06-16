import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsStatisticsRegressionMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/statistics-regression",
    domain: "mathematics",
    key: "lesson.mathematics.statistics-regression",
    kind: "lesson",
    slug: "statistics-regression",
    translations: {
      en: {
        description:
          "Learn how r² measures how well your regression line explains data variation. Learn coefficient of determination with visual examples and calculations.",
        title: "Statistics",
      },
      id: {
        description:
          "Pelajari bagaimana r² mengukur seberapa baik garis regresi menjelaskan variasi data. Pahami koefisien determinasi dengan contoh visual dan perhitungan.",
        title: "Statistika",
      },
    },
    sections: [
      {
        slug: "coefficient-of-determination",
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
