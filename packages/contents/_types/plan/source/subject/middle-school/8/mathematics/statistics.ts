import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectMiddleSchool8MathematicsStatisticsTopic =
  defineSubjectPlanTopic({
    slug: "statistics",
    translations: {
      en: {
        description:
          "Read center, range, quartiles, and data spread before drawing conclusions.",
        title: "Statistics",
      },
      id: {
        description:
          "Membaca pemusatan, jangkauan, kuartil, dan sebaran data sebelum menarik kesimpulan.",
        title: "Statistika",
      },
    },
    sections: [
      {
        slug: "centrality",
        translations: {
          en: {
            title: "Data Centrality",
          },
          id: {
            title: "Pemusatan Data",
          },
        },
      },
      {
        slug: "mode",
        translations: {
          en: {
            title: "Mode",
          },
          id: {
            title: "Modus",
          },
        },
      },
      {
        slug: "median",
        translations: {
          en: {
            title: "Median",
          },
          id: {
            title: "Median",
          },
        },
      },
      {
        slug: "median-odd",
        translations: {
          en: {
            title: "Median with Odd Data",
          },
          id: {
            title: "Menentukan Median dengan Banyak Data Ganjil",
          },
        },
      },
      {
        slug: "median-even",
        translations: {
          en: {
            title: "Median with Even Data",
          },
          id: {
            title: "Menentukan Median dengan Banyak Data Genap",
          },
        },
      },
      {
        slug: "median-random",
        translations: {
          en: {
            title: "Median with Random Heterogeneous Data",
          },
          id: {
            title: "Menentukan Median dari Data yang Acak yang Heterogen",
          },
        },
      },
      {
        slug: "mean",
        translations: {
          en: {
            title: "Mean",
          },
          id: {
            title: "Rata-Rata",
          },
        },
      },
      {
        slug: "range",
        translations: {
          en: {
            title: "Range",
          },
          id: {
            title: "Jangkauan",
          },
        },
      },
      {
        slug: "quartiles",
        translations: {
          en: {
            title: "Quartiles",
          },
          id: {
            title: "Kuartil",
          },
        },
      },
      {
        slug: "quartile-range",
        translations: {
          en: {
            title: "Quartile Range and Deviation",
          },
          id: {
            title: "Jangkauan Kuartil dan Simpangan Kuartil",
          },
        },
      },
    ],
  });
