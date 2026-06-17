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
      description:
        "Learn arithmetic sequences with worked examples, formulas, and real-world applications. Learn to find general terms and solve sequence problems.",
      title: "Sequence and Series",
    },
    id: {
      description:
        "Pelajari barisan aritmetika dengan contoh bertahap, rumus suku umum, dan aplikasi nyata. Pelajari konsep beda dan pola bilangan.",
      title: "Barisan dan Deret",
    },
  },
  sections: [
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
  ],
});
