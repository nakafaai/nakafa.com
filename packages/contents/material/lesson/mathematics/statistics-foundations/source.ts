import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsStatisticsFoundationsMaterial =
  defineLessonMaterial({
    assetRoot: "material/lesson/mathematics/statistics-foundations",
    domain: "mathematics",
    key: "lesson.mathematics.statistics-foundations",
    kind: "lesson",
    slug: "statistics-foundations",
    routeSlugs: { en: "statistics-foundations", id: "statistika-dasar" },
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
        routeSlugs: {
          en: "central-tendency-usage",
          id: "penggunaan-ukuran-pemusatan",
        },
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
        routeSlugs: { en: "histogram", id: "histogram" },
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
        routeSlugs: { en: "interquartile-range", id: "jangkauan-interkuartil" },
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
        routeSlugs: { en: "mean", id: "mean-rerata-atau-rata-rata" },
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
        routeSlugs: {
          en: "mean-group-data",
          id: "mean-rata-rata-data-kelompok",
        },
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
        routeSlugs: {
          en: "median-mode-group-data",
          id: "median-dan-kelas-modus-data-kelompok",
        },
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
        routeSlugs: { en: "mode-median", id: "modus-dan-median" },
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
        routeSlugs: {
          en: "percentile-data-group",
          id: "persentil-data-kelompok",
        },
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
        routeSlugs: { en: "quartile-data-group", id: "kuartil-data-kelompok" },
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
        routeSlugs: { en: "quartile-data-single", id: "kuartil-data-tunggal" },
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
        routeSlugs: { en: "relative-frequency", id: "frekuensi-relatif" },
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
        routeSlugs: {
          en: "variance-standard-deviation-data-group",
          id: "varian-dan-simpangan-baku-data-kelompok",
        },
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
        routeSlugs: {
          en: "variance-standard-deviation-data-single",
          id: "varian-dan-simpangan-baku-data-tunggal",
        },
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
