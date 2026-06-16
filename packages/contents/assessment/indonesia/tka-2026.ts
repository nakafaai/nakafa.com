import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";

export const tkaAssessment = defineAssessment({
  programKey: LEARNING_PROGRAM_KEYS.tka2026,
  nodes: [
    {
      key: "tka",
      level: "section",
      materialKeys: [],
      order: 10,
      translations: {
        en: { title: "TKA" },
        id: { title: "TKA" },
      },
    },
    {
      key: "tka-mathematics",
      level: "domain",
      materialKeys: ["practice.assessment.tka.mathematics"],
      order: 10,
      parentKey: "tka",
      translations: {
        en: { title: "Mathematics" },
        id: { title: "Matematika" },
      },
    },
  ],
});
