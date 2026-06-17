import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsCombinatoricsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/combinatorics",
  domain: "mathematics",
  key: "lesson.mathematics.combinatorics",
  kind: "lesson",
  slug: "combinatorics",
  routeSlugs: { en: "combinatorics", id: "kombinatorik" },
  translations: {
    en: {
      description: "Expand powers quickly with binomial coefficients.",
      title: "Combinatorics",
    },
    id: {
      description: "Kembangkan pangkat cepat dengan koefisien binomial.",
      title: "Kombinatorik",
    },
  },
  sections: [
    {
      slug: "binomial-newton",
      routeSlugs: { en: "binomial-newton", id: "binomial-newton" },
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
      routeSlugs: { en: "circular-permutation", id: "permutasi-siklis" },
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
      routeSlugs: { en: "combination", id: "kombinasi" },
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
      routeSlugs: { en: "filling-place-rule", id: "aturan-pengisian-tempat" },
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
      routeSlugs: {
        en: "permutation-of-n-items-from-n-objects",
        id: "permutasi-semua-objek",
      },
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
      routeSlugs: {
        en: "permutation-with-identical-objects",
        id: "permutasi-dengan-objek-yang-sama",
      },
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
      routeSlugs: {
        en: "probability-of-an-event",
        id: "peluang-suatu-kejadian",
      },
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
      routeSlugs: {
        en: "probability-of-compound-events",
        id: "peluang-kejadian-majemuk",
      },
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
      routeSlugs: {
        en: "probability-of-independent-conditional-events",
        id: "peluang-kejadian-majemuk-saling-bebas-bersyarat",
      },
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
      routeSlugs: {
        en: "probability-of-independent-events",
        id: "peluang-kejadian-majemuk-saling-bebas",
      },
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
      routeSlugs: {
        en: "probability-of-mutually-exclusive-events",
        id: "peluang-kejadian-majemuk-saling-lepas",
      },
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
