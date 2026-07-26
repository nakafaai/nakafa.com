import {
  localeValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** Active public material lessons indexed for curriculum-card assembly. */
  materialCatalog: defineTable({
    contentKey: v.string(),
    locale: localeValidator,
    materialKey: v.string(),
    order: v.number(),
    parentPath: v.string(),
    projectionHash: v.string(),
    projectionJson: v.string(),
    publicPath: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
    sourcePath: v.string(),
  })
    .index("by_contentKey_and_locale", ["contentKey", "locale"])
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_locale_and_parentPath_and_order_and_publicPath", [
      "locale",
      "parentPath",
      "order",
      "publicPath",
    ])
    .index("by_locale_and_materialKey_and_order_and_publicPath", [
      "locale",
      "materialKey",
      "order",
      "publicPath",
    ]),
};

export default tables;
