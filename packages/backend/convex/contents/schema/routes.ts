import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import { storedPublicRouteValidator } from "@repo/backend/convex/contents/publicRoutes/spec";
import {
  publicRouteSitemapCountValidator,
  publicRouteSitemapPageValidator,
} from "@repo/backend/convex/contents/sitemap/spec";
import {
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const contentRouteKindValidator = literals(...CONTENT_ROUTE_KINDS);

const contentRoutePageItemValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  authors: v.array(v.object({ name: v.string() })),
  content_id: graphContentIdValidator,
  date: v.optional(v.number()),
  depth: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: contentRouteKindValidator,
  locale: localeValidator,
  markdown: v.boolean(),
  materialDomain: v.optional(materialValidator),
  official: v.optional(v.boolean()),
  parentRoute: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
  sourceParentPath: v.optional(v.string()),
  sourcePath: v.string(),
  syncedAt: v.number(),
  title: v.string(),
});

const tables = {
  /** Graph-backed public route projection read model. */
  contentRoutes: defineTable({
    ...learningGraphIdentityValidator.fields,
    authors: v.array(v.object({ name: v.string() })),
    contentHash: v.string(),
    content_id: graphContentIdValidator,
    date: v.optional(v.number()),
    depth: v.optional(v.number()),
    description: v.optional(v.string()),
    kind: contentRouteKindValidator,
    locale: localeValidator,
    markdown: v.boolean(),
    materialDomain: v.optional(materialValidator),
    official: v.optional(v.boolean()),
    parentRoute: v.optional(v.string()),
    route: v.string(),
    section: nakafaSectionValidator,
    sourceParentPath: v.optional(v.string()),
    sourcePath: v.string(),
    syncedAt: v.number(),
    title: v.string(),
  })
    .index("by_content_id", ["content_id"])
    .index("by_locale", ["locale"])
    .index("by_locale_and_route", ["locale", "route"])
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
    .index("by_locale_and_kind", ["locale", "kind"])
    .index("by_locale_and_section", ["locale", "section"])
    .index("by_locale_and_section_and_date", ["locale", "section", "date"])
    .index("by_locale_and_section_and_route", ["locale", "section", "route"])
    .index("by_locale_and_section_and_kind_and_route", [
      "locale",
      "section",
      "kind",
      "route",
    ])
    .index("by_locale_and_section_and_kind_and_sourcePath", [
      "locale",
      "section",
      "kind",
      "sourcePath",
    ])
    .index("by_locale_and_section_and_kind_and_parentRoute_and_route", [
      "locale",
      "section",
      "kind",
      "parentRoute",
      "route",
    ])
    .index("by_locale_and_section_and_kind_and_parentRoute_and_date", [
      "locale",
      "section",
      "kind",
      "parentRoute",
      "date",
    ])
    .index("by_kind", ["kind"])
    .index("by_section", ["section"]),

  /** Immutable route pages keyed by locale, section, generation, and page. */
  contentRoutePages: defineTable({
    locale: localeValidator,
    page: v.number(),
    routeCount: v.number(),
    routes: v.array(contentRoutePageItemValidator),
    section: nakafaSectionValidator,
    syncedAt: v.number(),
  }).index("by_locale_and_section_and_syncedAt_and_page", [
    "locale",
    "section",
    "syncedAt",
    "page",
  ]),

  /** Committed route counts and generation pointers for public artifacts. */
  contentRouteCounts: defineTable({
    count: v.number(),
    locale: localeValidator,
    section: nakafaSectionValidator,
    syncedAt: v.number(),
  })
    .index("by_locale", ["locale"])
    .index("by_locale_and_section", ["locale", "section"]),

  /** Locale totals used to discover bounded public sitemap pages. */
  publicRouteSitemapCounts: defineTable(
    publicRouteSitemapCountValidator.fields
  ).index("by_locale", ["locale"]),

  /** Immutable exact paths keyed by locale, generation, and page. */
  publicRouteSitemapPages: defineTable(
    publicRouteSitemapPageValidator.fields
  ).index("by_locale_and_syncedAt_and_page", ["locale", "syncedAt", "page"]),

  /** Durable public routes shared by app, SEO, assistant, and navigation. */
  publicRoutes: defineTable(storedPublicRouteValidator.fields)
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_locale_and_kind_and_publicPath", [
      "locale",
      "kind",
      "publicPath",
    ])
    .index("by_locale_and_kind_and_parentPath_and_publicPath", [
      "locale",
      "kind",
      "parentPath",
      "publicPath",
    ])
    .index("by_programKey_and_locale_and_publicPath", [
      "programKey",
      "locale",
      "publicPath",
    ])
    .index("by_programKey_and_locale_and_parentPath_and_publicPath", [
      "programKey",
      "locale",
      "parentPath",
      "publicPath",
    ])
    .index("by_programKey_and_locale_and_parentPath_and_order", [
      "programKey",
      "locale",
      "parentPath",
      "order",
    ])
    .index("by_programKey_and_locale_and_kind_and_parentPath_and_publicPath", [
      "programKey",
      "locale",
      "kind",
      "parentPath",
      "publicPath",
    ])
    .index("by_materialKey_and_locale", ["materialKey", "locale"])
    .index("by_materialKey_and_locale_and_programKey_and_contextNodeKey", [
      "materialKey",
      "locale",
      "programKey",
      "materialContextNodeKey",
    ])
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
    .index("by_syncShard", ["syncShard"]),
};

export default tables;
