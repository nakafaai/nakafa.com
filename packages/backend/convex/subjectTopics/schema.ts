import {
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Subject topic storage (e.g., "Integrals", "Derivatives").
   * Groups related sections together.
   * Synced from typed Plan sources in packages/contents.
   */
  subjectTopics: defineTable({
    locale: localeValidator,
    /** Full URL path: "subject/high-school/12/mathematics/integral" */
    slug: v.string(),
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    /** Authored topic position inside the typed Plan source */
    order: v.number(),
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
    .index("by_locale_and_slug", ["locale", "slug"])
    .index("by_locale_and_category_and_grade_and_material_and_order", [
      "locale",
      "category",
      "grade",
      "material",
      "order",
    ]),
};

export default tables;
