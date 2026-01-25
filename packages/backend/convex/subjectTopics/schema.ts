import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "../lib/contentValidators";

const tables = {
  /**
   * Subject topic storage (e.g., "Integrals", "Derivatives").
   * Groups related sections together.
   * Synced from _data/*-material.ts files.
   */
  subjectTopics: defineTable({
    locale: localeValidator,
    /** Full URL path: "subject/high-school/12/mathematics/integral" */
    slug: v.string(),
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    /** Topic slug: "integral", "derivative-function" */
    topic: v.string(),
    /** Display title: "Integrals" */
    title: v.string(),
    /** Optional description from material file */
    description: v.optional(v.string()),
    /** Number of sections in this topic */
    sectionCount: v.number(),
    /** Last sync timestamp (epoch ms) */
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("locale_category_grade_material", [
      "locale",
      "category",
      "grade",
      "material",
    ]),
};

export default tables;
