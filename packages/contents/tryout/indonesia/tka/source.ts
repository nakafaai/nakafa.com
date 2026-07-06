import { defineTryoutExamSource } from "@repo/contents/_types/tryout/schema";

/** Source-controlled TKA try-out catalog and question placements. */
export const tkaTryoutSource = defineTryoutExamSource({
  countryCode: "ID",
  countryKey: "indonesia",
  countryRouteSlugs: { en: "indonesia", id: "indonesia" },
  countryTranslations: {
    en: { title: "Indonesia" },
    id: { title: "Indonesia" },
  },
  examKey: "tka",
  examRouteSlugs: { en: "tka", id: "tka" },
  examTranslations: {
    en: {
      description: "Indonesian academic competency try-outs.",
      title: "TKA",
    },
    id: {
      description: "Try out Tes Kemampuan Akademik Indonesia.",
      title: "TKA",
    },
  },
  scoringStrategy: "raw",
  sets: [1, 2, 3].map((setNumber) => ({
    key: `set-${setNumber}`,
    order: setNumber,
    routeSlugs: {
      en: `set-${setNumber}`,
      id: `set-${setNumber}`,
    },
    sections: [
      {
        key: "mathematics",
        order: 1,
        questionCount: 40,
        questionSourcePath: `question-bank/tryout/indonesia/tka/mathematics/set-${setNumber}`,
        routeSlugs: { en: "mathematics", id: "matematika" },
        translations: {
          en: { title: "Mathematics" },
          id: { title: "Matematika" },
        },
      },
    ],
    translations: {
      en: { title: `Set ${setNumber}` },
      id: { title: `Set ${setNumber}` },
    },
  })),
  sourceRevision: "2026-07-05",
});
