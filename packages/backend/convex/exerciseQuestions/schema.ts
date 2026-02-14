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
   * Exercise question storage.
   * Each row is a single question within an exercise set.
   * URL structure: /exercises/{category}/{type}/{material}/{exerciseType}/{setName}/{number}
   * Authors are linked via contentAuthors join table.
   */
  exerciseQuestions: defineTable({
    /** Reference to parent exercise set */
    setId: v.id("exerciseSets"),
    locale: localeValidator,
    /** Full URL path: "exercises/high-school/tka/mathematics/try-out/set-1/12" */
    slug: v.string(),
    /** Denormalized for query performance */
    category: exercisesCategoryValidator,
    /** Exam type: "grade-9", "tka", "snbt" */
    type: exercisesTypeValidator,
    material: exercisesMaterialValidator,
    /** Exercise format: "try-out", "practice", "drill" */
    exerciseType: v.string(),
    /** Set identifier: "set-1", "set-2" */
    setName: v.string(),
    /** Question number within the set (1-based) */
    number: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    /** Publication date as epoch milliseconds */
    date: v.number(),
    /** Question MDX content */
    questionBody: v.string(),
    /** Answer/explanation MDX content */
    answerBody: v.string(),
    /** SHA-256 hash for sync change detection */
    contentHash: v.string(),
    /** Last sync timestamp (epoch ms) */
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("setId", ["setId"])
    .index("locale_category_type_material", [
      "locale",
      "category",
      "type",
      "material",
    ])
    .index("locale_category_type_material_exerciseType_setName", [
      "locale",
      "category",
      "type",
      "material",
      "exerciseType",
      "setName",
    ])
    .index("contentHash", ["contentHash"]),

  /**
   * Normalized multiple choice options.
   * Separate table so each choice has an _id (useful for tracking user answers).
   */
  exerciseChoices: defineTable({
    questionId: v.id("exerciseQuestions"),
    locale: localeValidator,
    /** Option letter: "A", "B", "C", "D", "E" */
    optionKey: v.string(),
    /** Option text/content */
    label: v.string(),
    isCorrect: v.boolean(),
    /** Display order (0-based) */
    order: v.number(),
  }).index("questionId_locale", ["questionId", "locale"]),
};

export default tables;
