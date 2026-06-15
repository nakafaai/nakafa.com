import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11MathematicsStatisticsTopic =
  defineSubjectPlanTopic({
    slug: "statistics",
    translations: {
      en: {
        description:
          "The language of numbers for analyzing trends, making predictions, and uncovering hidden patterns.",
        title: "Statistics",
      },
      id: {
        description:
          "Bahasa angka untuk menganalisis tren, membuat prediksi, dan mengungkap pola tersembunyi.",
        title: "Statistika",
      },
    },
    sections: [
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
    ],
  });
