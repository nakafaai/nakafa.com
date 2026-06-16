import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsCombinatoricsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/combinatorics",
  domain: "mathematics",
  key: "lesson.mathematics.combinatorics",
  kind: "lesson",
  slug: "combinatorics",
  translations: {
    en: {
      description:
        "Learn binomial theorem to expand (x+y)^n quickly. Learn coefficients, constant terms, and problem-solving with worked examples and practice problems.",
      title: "Combinatorics",
    },
    id: {
      description:
        "Pelajari teorema binomial untuk mengembangkan (x+y)^n dengan cepat. Pahami koefisien, suku konstanta, dan strategi penyelesaian lewat contoh serta latihan.",
      title: "Kombinatorik",
    },
  },
  sections: [
    {
      slug: "binomial-newton",
      translations: {
        en: {
          title: "Binomial Newton",
        },
        id: {
          title: "Binomial Newton",
        },
      },
    },
    {
      slug: "circular-permutation",
      translations: {
        en: {
          title: "Circular Permutation",
        },
        id: {
          title: "Permutasi Siklis",
        },
      },
    },
    {
      slug: "combination",
      translations: {
        en: {
          title: "Combination",
        },
        id: {
          title: "Kombinasi",
        },
      },
    },
    {
      slug: "filling-place-rule",
      translations: {
        en: {
          title: "Slot Filling Rule",
        },
        id: {
          title: "Aturan Pengisian Tempat",
        },
      },
    },
    {
      slug: "permutation-of-n-items-from-n-objects",
      translations: {
        en: {
          title: "Permutation of All Objects",
        },
        id: {
          title: "Permutasi Semua Objek",
        },
      },
    },
    {
      slug: "permutation-with-identical-objects",
      translations: {
        en: {
          title: "Permutation with Identical Objects",
        },
        id: {
          title: "Permutasi dengan Objek yang Sama",
        },
      },
    },
    {
      slug: "probability-of-an-event",
      translations: {
        en: {
          title: "Probability of an Event",
        },
        id: {
          title: "Peluang Suatu Kejadian",
        },
      },
    },
    {
      slug: "probability-of-compound-events",
      translations: {
        en: {
          title: "Probability of Compound Events",
        },
        id: {
          title: "Peluang Kejadian Majemuk",
        },
      },
    },
    {
      slug: "probability-of-independent-conditional-events",
      translations: {
        en: {
          title: "Probability of Independent Conditional Events",
        },
        id: {
          title: "Peluang Kejadian Majemuk Saling Bebas Bersyarat",
        },
      },
    },
    {
      slug: "probability-of-independent-events",
      translations: {
        en: {
          title: "Probability of Independent Events",
        },
        id: {
          title: "Peluang Kejadian Majemuk Saling Bebas",
        },
      },
    },
    {
      slug: "probability-of-mutually-exclusive-events",
      translations: {
        en: {
          title: "Probability of Mutually Exclusive Events",
        },
        id: {
          title: "Peluang Kejadian Majemuk Saling Lepas",
        },
      },
    },
  ],
});
