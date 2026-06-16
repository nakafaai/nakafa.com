import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";

export const snbtAssessment = defineAssessment({
  programKey: LEARNING_PROGRAM_KEYS.snbt2026,
  nodes: [
    {
      key: "snbt",
      level: "section",
      materialKeys: [],
      order: 10,
      translations: {
        en: { title: "SNBT" },
        id: { title: "SNBT" },
      },
    },
    {
      key: "snbt-quantitative-knowledge",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.quantitative-knowledge"],
      order: 10,
      parentKey: "snbt",
      translations: {
        en: { title: "Quantitative Knowledge" },
        id: { title: "Pengetahuan Kuantitatif" },
      },
    },
    {
      key: "snbt-mathematical-reasoning",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.mathematical-reasoning"],
      order: 20,
      parentKey: "snbt",
      translations: {
        en: { title: "Mathematical Reasoning" },
        id: { title: "Penalaran Matematika" },
      },
    },
    {
      key: "snbt-general-reasoning",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.general-reasoning"],
      order: 30,
      parentKey: "snbt",
      translations: {
        en: { title: "General Reasoning" },
        id: { title: "Penalaran Umum" },
      },
    },
    {
      key: "snbt-indonesian-language",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.indonesian-language"],
      order: 40,
      parentKey: "snbt",
      translations: {
        en: { title: "Indonesian Language" },
        id: { title: "Bahasa Indonesia" },
      },
    },
    {
      key: "snbt-english-language",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.english-language"],
      order: 50,
      parentKey: "snbt",
      translations: {
        en: { title: "English Language" },
        id: { title: "Bahasa Inggris" },
      },
    },
    {
      key: "snbt-general-knowledge",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.general-knowledge"],
      order: 60,
      parentKey: "snbt",
      translations: {
        en: { title: "General Knowledge" },
        id: { title: "Pengetahuan Umum" },
      },
    },
    {
      key: "snbt-reading-and-writing-skills",
      level: "domain",
      materialKeys: ["practice.assessment.snbt.reading-and-writing-skills"],
      order: 70,
      parentKey: "snbt",
      translations: {
        en: { title: "Reading and Writing Skills" },
        id: { title: "Kemampuan Memahami Bacaan dan Menulis" },
      },
    },
  ],
});
