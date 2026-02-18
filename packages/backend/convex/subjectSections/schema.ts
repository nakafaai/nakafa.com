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
   * Subject section storage (individual lessons within a topic).
   * URL structure: /subject/{category}/{grade}/{material}/{topic}/{section}
   * Authors are linked via contentAuthors join table.
   */
  subjectSections: defineTable({
    /** Reference to parent subject topic */
    topicId: v.id("subjectTopics"),
    locale: localeValidator,
    /** Full URL path: "subject/high-school/12/mathematics/integral/riemann-sum" */
    slug: v.string(),
    /** Denormalized for query performance */
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    /** Topic slug: "integral", "derivative-function" */
    topic: v.string(),
    /** Section slug: "riemann-sum", "definite-integral" */
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
    .index("topicId", ["topicId"])
    .index("locale_category_grade_material", [
      "locale",
      "category",
      "grade",
      "material",
    ])
    .index("contentHash", ["contentHash"]),
};

export default tables;
