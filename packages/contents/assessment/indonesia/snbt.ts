import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";

export const snbtAssessment = defineAssessment({
  programKey: LEARNING_PROGRAM_KEYS.snbt,
  nodes: [
    {
      key: "snbt",
      level: "section",
      materialKeys: [],
      order: 10,
      translations: {
        en: { routeSlug: "snbt", title: "SNBT" },
        id: { routeSlug: "snbt", title: "SNBT" },
      },
    },
    {
      key: "snbt-quantitative-knowledge",
      level: "domain",
      materialKeys: [],
      order: 10,
      parentKey: "snbt",
      translations: {
        en: {
          routeSlug: "quantitative-knowledge",
          title: "Quantitative Knowledge",
        },
        id: {
          routeSlug: "pengetahuan-kuantitatif",
          title: "Pengetahuan Kuantitatif",
        },
      },
    },
    {
      key: "snbt-mathematical-reasoning",
      level: "domain",
      materialKeys: [],
      order: 20,
      parentKey: "snbt",
      translations: {
        en: {
          routeSlug: "mathematical-reasoning",
          title: "Mathematical Reasoning",
        },
        id: {
          routeSlug: "penalaran-matematika",
          title: "Penalaran Matematika",
        },
      },
    },
    {
      key: "snbt-general-reasoning",
      level: "domain",
      materialKeys: [],
      order: 30,
      parentKey: "snbt",
      translations: {
        en: { routeSlug: "general-reasoning", title: "General Reasoning" },
        id: { routeSlug: "penalaran-umum", title: "Penalaran Umum" },
      },
    },
    {
      key: "snbt-indonesian-language",
      level: "domain",
      materialKeys: [],
      order: 40,
      parentKey: "snbt",
      translations: {
        en: { routeSlug: "indonesian-language", title: "Indonesian Language" },
        id: { routeSlug: "bahasa-indonesia", title: "Bahasa Indonesia" },
      },
    },
    {
      key: "snbt-english-language",
      level: "domain",
      materialKeys: [],
      order: 50,
      parentKey: "snbt",
      translations: {
        en: { routeSlug: "english-language", title: "English Language" },
        id: { routeSlug: "bahasa-inggris", title: "Bahasa Inggris" },
      },
    },
    {
      key: "snbt-general-knowledge",
      level: "domain",
      materialKeys: [],
      order: 60,
      parentKey: "snbt",
      translations: {
        en: { routeSlug: "general-knowledge", title: "General Knowledge" },
        id: { routeSlug: "pengetahuan-umum", title: "Pengetahuan Umum" },
      },
    },
    {
      key: "snbt-reading-and-writing-skills",
      level: "domain",
      materialKeys: [],
      order: 70,
      parentKey: "snbt",
      translations: {
        en: {
          routeSlug: "reading-and-writing-skills",
          title: "Reading and Writing Skills",
        },
        id: {
          routeSlug: "kemampuan-memahami-bacaan-dan-menulis",
          title: "Kemampuan Memahami Bacaan dan Menulis",
        },
      },
    },
  ],
});
