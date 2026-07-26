import {
  contentFamilyValidator,
  localeValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const scopeSchema = {
  /** Immutable exact-content ownership selected by publication sequence. */
  contentOwners: defineTable({
    contentKey: v.string(),
    family: contentFamilyValidator,
    locale: localeValidator,
    managed: v.boolean(),
    releaseId: v.string(),
    sequence: v.number(),
  })
    .index("by_contentKey_and_locale_and_sequence", [
      "contentKey",
      "locale",
      "sequence",
    ])
    .index("by_releaseId_and_contentKey_and_locale", [
      "releaseId",
      "contentKey",
      "locale",
    ])
    .index("by_sequence", ["sequence"]),
};

export default scopeSchema;
