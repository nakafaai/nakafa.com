import {
  localeValidator,
  materialValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /**
   * Curriculum topic storage (e.g., "Integrals", "Derivatives").
   * Groups related sections together.
   * Synced from typed Material sources in packages/contents.
   */
  curriculumTopics: defineTable({
    locale: localeValidator,
    /** Full URL path: "material/lesson/mathematics/integral" */
    slug: v.string(),
    material: materialValidator,
    /** Authored topic position inside the typed Material source */
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
    .index("by_locale_and_material_and_order", ["locale", "material", "order"]),
};

export default tables;
