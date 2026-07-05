import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const materialKindValidator = literals("lesson");

export const materialDomainValidator = v.string();

const materialConceptValidator = v.object({
  key: v.string(),
  source: literals("authored", "generated"),
});

const localizedMaterialMetadataValidator = v.object({
  description: v.optional(v.string()),
  title: v.string(),
});

const tables = {
  /**
   * Curriculum-neutral material identity.
   * One row per reusable lesson material source.
   */
  materials: defineTable({
    concepts: v.array(materialConceptValidator),
    domain: materialDomainValidator,
    key: v.string(),
    kind: materialKindValidator,
    route: v.string(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_kind_and_domain_and_key", ["kind", "domain", "key"])
    .index("by_syncedAt", ["syncedAt"]),

  /**
   * Localized material asset projection.
   * MDX owns localized learner-facing body/copy; curriculum membership lives in
   * curriculum/assessment mapping tables.
   */
  materialLocales: defineTable({
    body: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    date: v.optional(v.number()),
    locale: localeValidator,
    materialKey: v.string(),
    metadata: localizedMaterialMetadataValidator,
    route: v.string(),
    sectionKey: v.optional(v.string()),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_materialKey_and_locale", ["materialKey", "locale"])
    .index("by_locale_and_route", ["locale", "route"])
    .index("by_locale_and_syncedAt", ["locale", "syncedAt"])
    .index("by_locale_and_materialKey_and_sectionKey", [
      "locale",
      "materialKey",
      "sectionKey",
    ])
    .index("by_syncedAt", ["syncedAt"]),
};

export default tables;
