import {
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Exercise set storage (e.g., "Set 1", "Set 2").
   * Groups related questions together.
   * Synced from _data/*-material.ts files.
   */
  exerciseSets: defineTable({
    locale: localeValidator,
    /** Full URL path: "exercises/high-school/snbt/quantitative-knowledge/try-out/set-1" */
    slug: v.string(),
    category: exercisesCategoryValidator,
    /** Exam type: "grade-9", "tka", "snbt" */
    type: exercisesTypeValidator,
    material: exercisesMaterialValidator,
    /** Exercise format: "try-out", "practice", "drill" */
    exerciseType: v.string(),
    /** Set identifier: "set-1", "set-2" */
    setName: v.string(),
    /** Display title: "Set 1" */
    title: v.string(),
    /** Optional description from parent exerciseType */
    description: v.optional(v.string()),
    /** Number of questions in this set */
    questionCount: v.number(),
    /** Last sync timestamp (epoch ms) */
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("locale_category_type_material", [
      "locale",
      "category",
      "type",
      "material",
    ])
    .index("locale_category_type_material_exerciseType", [
      "locale",
      "category",
      "type",
      "material",
      "exerciseType",
    ]),
};

export default tables;
