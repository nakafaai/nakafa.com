import { ConceptSchema } from "@repo/contents/_types/concept/schema";
import { Schema } from "effect";

/**
 * Typed bootstrap source for Nakafa's canonical concept graph.
 *
 * Real curriculum imports should expand this Module through reviewed TS source
 * rows or generated TS modules, not JSON dumps or per-MDX curriculum tags.
 */
export const CONCEPT_SOURCE = Schema.decodeUnknownSync(
  Schema.Array(ConceptSchema)
)([
  {
    domain: "mathematics",
    key: "math.algebra.linear-equation",
    prerequisites: [],
    skills: ["solve-linear-equation"],
    translations: {
      en: { title: "Linear equations" },
      id: { title: "Persamaan linear" },
    },
  },
  {
    domain: "mathematics",
    key: "math.statistics.mean",
    prerequisites: ["math.algebra.linear-equation"],
    skills: ["calculate-mean", "interpret-average"],
    translations: {
      en: { title: "Mean" },
      id: { title: "Rata-rata" },
    },
  },
  {
    domain: "reasoning",
    key: "reasoning.quantitative",
    prerequisites: ["math.algebra.linear-equation"],
    skills: ["interpret-quantitative-data"],
    translations: {
      en: { title: "Quantitative reasoning" },
      id: { title: "Penalaran kuantitatif" },
    },
  },
  {
    domain: "science",
    key: "science.foundation",
    prerequisites: [],
    skills: ["explain-scientific-model"],
    translations: {
      en: { title: "Science foundations" },
      id: { title: "Dasar sains" },
    },
  },
]);
