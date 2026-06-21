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
        en: { routeSlug: "tka", title: "TKA" },
        id: { routeSlug: "tka", title: "TKA" },
      },
    },
    {
      key: "tka-mathematics",
      level: "domain",
      materialKeys: ["practice.assessment.tka.mathematics"],
      order: 10,
      parentKey: "tka",
      translations: {
        en: { routeSlug: "mathematics", title: "Mathematics" },
        id: { routeSlug: "matematika", title: "Matematika" },
      },
    },
  ],
});
