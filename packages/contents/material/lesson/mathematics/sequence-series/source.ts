import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsSequenceSeriesMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/sequence-series",
  domain: "mathematics",
  key: "lesson.mathematics.sequence-series",
  kind: "lesson",
  slug: "sequence-series",
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
