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
   * Subject/lesson content storage.
   * URL structure: /subject/{category}/{grade}/{material}/{topic}/{section}
   * Authors are linked via contentAuthors join table.
   */
  subjectContents: defineTable({
    locale: localeValidator,
    /** Full URL path: "subject/high-school/12/mathematics/limit/concept-of-limit" */
    slug: v.string(),
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    /** Topic slug: "limit", "integral", "derivative" */
    topic: v.string(),
    /** Section slug: "concept-of-limit", "limit-theorems" */
    section: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    /** Publication date as epoch milliseconds */
    date: v.number(),
    /** Chapter/topic name from MDX metadata */
    subject: v.optional(v.string()),
    /** MDX content (metadata export stripped) */
    body: v.string(),
    /** SHA-256 hash of body for sync change detection */
    contentHash: v.string(),
    /** Last sync timestamp (epoch ms) */
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("locale_category_grade_material", [
      "locale",
      "category",
      "grade",
      "material",
    ])
    .index("contentHash", ["contentHash"]),
};

export default tables;
