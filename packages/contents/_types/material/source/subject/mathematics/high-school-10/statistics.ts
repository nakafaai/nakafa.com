import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool10MathematicsStatisticsTopic =
  defineSubjectMaterialTopic({
    slug: "statistics",
    translations: {
      en: {
        description: "The art of data analysis for real-world decision making.",
        title: "Statistics",
      },
      id: {
        description:
          "Seni analisis data untuk pengambilan keputusan di dunia nyata.",
        title: "Statistika",
      },
    },
    sections: [
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
    ],
  });
