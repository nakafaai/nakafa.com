import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsSequenceSeriesMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/sequence-series",
  domain: "mathematics",
  key: "lesson.mathematics.sequence-series",
  kind: "lesson",
  slug: "sequence-series",
  routeSlugs: { en: "sequence-series", id: "barisan-dan-deret" },
  translations: {
    en: {
      description: "Find arithmetic patterns, terms, and sums.",
      title: "Sequence and Series",
    },
    id: {
      description: "Temukan pola, suku, dan jumlah barisan aritmetika.",
      title: "Barisan dan Deret",
    },
  },
  sections: [
    {
      slug: "sequence-concept",
      routeSlugs: { en: "sequence-concept", id: "konsep-barisan" },
      translations: {
        en: {
          title: "Sequence Concept",
        },
        id: {
          title: "Konsep Barisan",
        },
      },
    },
    {
      slug: "arithmetic-sequence",
      routeSlugs: { en: "arithmetic-sequence", id: "barisan-aritmetika" },
      translations: {
        en: {
          title: "Arithmetic Sequence",
        },
        id: {
          title: "Barisan Aritmetika",
        },
      },
    },
    {
      slug: "geometric-sequence",
      routeSlugs: { en: "geometric-sequence", id: "barisan-geometri" },
      translations: {
        en: {
          title: "Geometric Sequence",
        },
        id: {
          title: "Barisan Geometri",
        },
      },
    },
    {
      slug: "difference-arithmetic-geometric-sequence",
      routeSlugs: {
        en: "difference-arithmetic-geometric-sequence",
        id: "perbedaan-barisan-aritmetika-dan-geometri",
      },
      translations: {
        en: {
          title: "Difference between Arithmetic and Geometric Sequence",
        },
        id: {
          title: "Perbedaan Barisan Aritmetika dan Geometri",
        },
      },
    },
    {
      slug: "difference-sequence-series",
      routeSlugs: {
        en: "difference-sequence-series",
        id: "perbedaan-barisan-dan-deret",
      },
      translations: {
        en: {
          title: "Difference between Sequence and Series",
        },
        id: {
          title: "Perbedaan Barisan dan Deret",
        },
      },
    },
    {
      slug: "series-concept",
      routeSlugs: { en: "series-concept", id: "konsep-deret" },
      translations: {
        en: {
          title: "Series Concept",
        },
        id: {
          title: "Konsep Deret",
        },
      },
    },
    {
      slug: "arithmetic-series",
      routeSlugs: { en: "arithmetic-series", id: "deret-aritmetika" },
      translations: {
        en: {
          title: "Arithmetic Series",
        },
        id: {
          title: "Deret Aritmetika",
        },
      },
    },
    {
      slug: "geometric-series",
      routeSlugs: { en: "geometric-series", id: "deret-geometri" },
      translations: {
        en: {
          title: "Geometric Series",
        },
        id: {
          title: "Deret Geometri",
        },
      },
    },
    {
      slug: "infinite-geometric-series",
      routeSlugs: {
        en: "infinite-geometric-series",
        id: "deret-geometri-tak-hingga",
      },
      translations: {
        en: {
          title: "Infinite Geometric Series",
        },
        id: {
          title: "Deret Geometri Tak Hingga",
        },
      },
    },
    {
      slug: "difference-arithmetic-geometric-series",
      routeSlugs: {
        en: "difference-arithmetic-geometric-series",
        id: "perbedaan-deret-aritmetika-dan-geometri",
      },
      translations: {
        en: {
          title: "Difference between Arithmetic and Geometric Series",
        },
        id: {
          title: "Perbedaan Deret Aritmetika dan Geometri",
        },
      },
    },
    {
      slug: "convergence-divergence",
      routeSlugs: {
        en: "convergence-divergence",
        id: "perbedaan-konvergen-dan-divergen",
      },
      translations: {
        en: {
          title: "Difference Between Convergence and Divergence",
        },
        id: {
          title: "Perbedaan Konvergen dan Divergen",
        },
      },
    },
  ],
});
