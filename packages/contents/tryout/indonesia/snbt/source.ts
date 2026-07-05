import { defineTryoutExamSource } from "@repo/contents/_types/tryout/schema";

const snbtSections = [
  {
    key: "quantitative-knowledge",
    questionCount: 20,
    routeSlugs: {
      en: "quantitative-knowledge",
      id: "pengetahuan-kuantitatif",
    },
    translations: {
      en: { title: "Quantitative Knowledge" },
      id: { title: "Pengetahuan Kuantitatif" },
    },
  },
  {
    key: "mathematical-reasoning",
    questionCount: 20,
    routeSlugs: {
      en: "mathematical-reasoning",
      id: "penalaran-matematika",
    },
    translations: {
      en: { title: "Mathematical Reasoning" },
      id: { title: "Penalaran Matematika" },
    },
  },
  {
    key: "general-reasoning",
    questionCount: 20,
    routeSlugs: { en: "general-reasoning", id: "penalaran-umum" },
    translations: {
      en: { title: "General Reasoning" },
      id: { title: "Penalaran Umum" },
    },
  },
  {
    key: "indonesian-language",
    questionCount: 30,
    routeSlugs: { en: "indonesian-language", id: "bahasa-indonesia" },
    translations: {
      en: { title: "Indonesian Language" },
      id: { title: "Bahasa Indonesia" },
    },
  },
  {
    key: "english-language",
    questionCount: 20,
    routeSlugs: { en: "english-language", id: "bahasa-inggris" },
    translations: {
      en: { title: "English Language" },
      id: { title: "Bahasa Inggris" },
    },
  },
  {
    key: "general-knowledge",
    questionCount: 20,
    routeSlugs: { en: "general-knowledge", id: "pengetahuan-umum" },
    translations: {
      en: { title: "General Knowledge" },
      id: { title: "Pengetahuan Umum" },
    },
  },
  {
    key: "reading-and-writing-skills",
    questionCount: 20,
    routeSlugs: {
      en: "reading-and-writing-skills",
      id: "literasi-membaca-menulis",
    },
    translations: {
      en: { title: "Reading and Writing Skills" },
      id: { title: "Literasi Membaca dan Menulis" },
    },
  },
] as const;

/** Source-controlled SNBT try-out catalog and question placements. */
export const snbtTryoutSource = defineTryoutExamSource({
  countryKey: "indonesia",
  countryRouteSlugs: { en: "indonesia", id: "indonesia" },
  countryTranslations: {
    en: { title: "Indonesia" },
    id: { title: "Indonesia" },
  },
  examKey: "snbt",
  examRouteSlugs: { en: "snbt", id: "snbt" },
  examTranslations: {
    en: {
      description: "Indonesian university entrance try-outs.",
      title: "SNBT",
    },
    id: {
      description: "Try out seleksi masuk perguruan tinggi Indonesia.",
      title: "SNBT",
    },
  },
  scoringStrategy: "irt",
  sets: [1, 2].map((setNumber) => ({
    key: `set-${setNumber}`,
    order: setNumber,
    routeSlugs: {
      en: `set-${setNumber}`,
      id: `set-${setNumber}`,
    },
    sections: snbtSections.map((section, sectionIndex) => ({
      ...section,
      order: sectionIndex + 1,
      questionSourcePath: `question-bank/tryout/indonesia/snbt/${section.key}/set-${setNumber}`,
    })),
    translations: {
      en: { title: `Set ${setNumber}` },
      id: { title: `Set ${setNumber}` },
    },
  })),
  sourceRevision: "2026-07-05",
});
