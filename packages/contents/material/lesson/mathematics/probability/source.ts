import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsProbabilityMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/probability",
  domain: "mathematics",
  key: "lesson.mathematics.probability",
  kind: "lesson",
  slug: "probability",
  routeSlugs: { en: "probability", id: "peluang" },
  translations: {
    en: {
      description:
        "Learn probability addition rule for OR events. Learn mutually exclusive vs non-mutually exclusive events with clear examples, formulas, and worked solutions.",
      title: "Probability",
    },
    id: {
      description:
        "Pelajari aturan penjumlahan peluang untuk kejadian ATAU. Bedakan kejadian saling lepas dan tidak saling lepas dengan contoh, rumus, dan pembahasan soal.",
      title: "Peluang",
    },
  },
  sections: [
    {
      slug: "addition-rule",
      routeSlugs: { en: "addition-rule", id: "aturan-penjumlahan" },
      translations: {
        en: {
          title: "Addition Rule",
        },
        id: {
          title: "Aturan Penjumlahan",
        },
      },
    },
    {
      slug: "probability-distribution",
      routeSlugs: { en: "probability-distribution", id: "distribusi-peluang" },
      translations: {
        en: {
          title: "Probability Distribution",
        },
        id: {
          title: "Distribusi Peluang",
        },
      },
    },
    {
      slug: "two-events-mutually-exclusive",
      routeSlugs: {
        en: "two-events-mutually-exclusive",
        id: "dua-kejadian-a-dan-b-saling-lepas",
      },
      translations: {
        en: {
          title: "Mutually Exclusive Events A and B",
        },
        id: {
          title: "Dua Kejadian A dan B Saling Lepas",
        },
      },
    },
    {
      slug: "two-events-not-mutually-exclusive",
      routeSlugs: {
        en: "two-events-not-mutually-exclusive",
        id: "dua-kejadian-a-dan-b-tidak-saling-lepas",
      },
      translations: {
        en: {
          title: "Non-Mutually Exclusive Events A and B",
        },
        id: {
          title: "Dua Kejadian A dan B Tidak Saling Lepas",
        },
      },
    },
  ],
});
