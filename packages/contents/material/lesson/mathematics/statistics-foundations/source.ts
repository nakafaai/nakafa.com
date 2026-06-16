import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsStatisticsFoundationsMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/statistics-foundations",
    domain: "mathematics",
    key: "lesson.mathematics.statistics-foundations",
    kind: "lesson",
    slug: "statistics-foundations",
    translations: {
      en: {
        description:
          "Learn when to use mean, median, or mode in statistics and how outliers affect each measure in real data.",
        title: "Statistics",
      },
      id: {
        description:
          "Pelajari kapan menggunakan mean, median, atau modus dalam statistika. Pahami pengaruh pencilan dan dapatkan panduan praktis analisis data.",
        title: "Statistika",
      },
    },
    sections: [
      {
        slug: "central-tendency-usage",
        translations: {
          en: {
            title: "Applications of Measures of Central Tendency",
          },
          id: {
            title: "Penggunaan Ukuran Pemusatan",
          },
        },
      },
      {
        slug: "histogram",
        translations: {
          en: {
            title: "Histogram",
          },
          id: {
            title: "Histogram",
          },
        },
      },
      {
        slug: "interquartile-range",
        translations: {
          en: {
            title: "Interquartile Range",
          },
          id: {
            title: "Jangkauan Interkuartil",
          },
        },
      },
      {
        slug: "mean",
        translations: {
          en: {
            title: "Mean (Average)",
          },
          id: {
            title: "Mean (Rerata atau Rata-rata)",
          },
        },
      },
      {
        slug: "mean-group-data",
        translations: {
          en: {
            title: "Mean for Grouped Data",
          },
          id: {
            title: "Mean/Rata-Rata Data Kelompok",
          },
        },
      },
      {
        slug: "median-mode-group-data",
        translations: {
          en: {
            title: "Median and Modal Class for Grouped Data",
          },
          id: {
            title: "Median dan Kelas Modus Data Kelompok",
          },
        },
      },
      {
        slug: "mode-median",
        translations: {
          en: {
            title: "Mode and Median",
          },
          id: {
            title: "Modus dan Median",
          },
        },
      },
      {
        slug: "percentile-data-group",
        translations: {
          en: {
            title: "Percentiles for Grouped Data",
          },
          id: {
            title: "Persentil Data Kelompok",
          },
        },
      },
      {
        slug: "quartile-data-group",
        translations: {
          en: {
            title: "Quartiles for Grouped Data",
          },
          id: {
            title: "Kuartil Data Kelompok",
          },
        },
      },
      {
        slug: "quartile-data-single",
        translations: {
          en: {
            title: "Quartiles for Ungrouped Data",
          },
          id: {
            title: "Kuartil Data Tunggal",
          },
        },
      },
      {
        slug: "relative-frequency",
        translations: {
          en: {
            title: "Relative Frequency",
          },
          id: {
            title: "Frekuensi Relatif",
          },
        },
      },
      {
        slug: "variance-standard-deviation-data-group",
        translations: {
          en: {
            title: "Variance and Standard Deviation for Grouped Data",
          },
          id: {
            title: "Varian dan Simpangan Baku Data Kelompok",
          },
        },
      },
      {
        slug: "variance-standard-deviation-data-single",
        translations: {
          en: {
            title: "Variance and Standard Deviation for Ungrouped Data",
          },
          id: {
            title: "Varian dan Simpangan Baku Data Tunggal",
          },
        },
      },
    ],
  });
