import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import {
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const LEGACY_CONTENT_ROUTE_KINDS = [
  "article",
  "curriculum-topic",
  "curriculum-lesson",
  "tryout-country",
  "tryout-exam",
  "tryout-track",
  "tryout-set",
  "tryout-section",
  "quran-surah",
] as const;

const LEGACY_PUBLIC_ROUTE_KINDS = [
  "article-category",
  "curriculum-context",
  "subject-lesson",
  "subject-topic",
] as const;

const LEGACY_NAVIGATION_ICON_KEYS = [
  "advanced",
  "assessment",
  "certificate",
  "course",
  "diploma",
  "early-years",
  "global-education",
  "grade-1",
  "grade-2",
  "grade-3",
  "grade-4",
  "grade-5",
  "grade-6",
  "grade-7",
  "grade-8",
  "grade-9",
  "grade-10",
  "grade-11",
  "grade-12",
  "high-school",
  "mathematics",
  "middle-school",
  "primary-school",
  "science",
  "school",
  "state",
  "standards",
] as const;

const LEGACY_NAVIGATION_LEVELS = [
  "class",
  "course",
  "domain",
  "lesson",
  "phase",
  "section",
  "stage",
  "set",
  "subject",
  "topic",
  "track",
  "unit",
] as const;

const contentRouteKindValidator = literals(...LEGACY_CONTENT_ROUTE_KINDS);
const publicRouteKindValidator = literals(...LEGACY_PUBLIC_ROUTE_KINDS);
const navigationIconKeyValidator = literals(...LEGACY_NAVIGATION_ICON_KEYS);
const navigationLevelValidator = literals(...LEGACY_NAVIGATION_LEVELS);

/** Exact retired route row shape retained only until the production drain. */
const storedPublicRouteValidator = v.object({
  canonicalPath: v.optional(v.string()),
  description: v.optional(v.string()),
  displayGroupIconKey: v.optional(navigationIconKeyValidator),
  displayGroupTitle: v.optional(v.string()),
  iconKey: v.optional(navigationIconKeyValidator),
  kind: publicRouteKindValidator,
  level: v.optional(navigationLevelValidator),
  locale: localeValidator,
  materialCardDescription: v.optional(v.string()),
  materialCardTitle: v.optional(v.string()),
  materialContextNodeKey: v.optional(v.string()),
  materialContextParentPath: v.optional(v.string()),
  materialContextPublicPath: v.optional(v.string()),
  materialDomain: v.optional(materialValidator),
  materialKey: v.optional(v.string()),
  nodeKey: v.optional(v.string()),
  order: v.optional(v.number()),
  parentPath: v.optional(v.string()),
  programKey: v.optional(v.string()),
  publicPath: v.string(),
  sectionKey: v.optional(v.string()),
  sitemap: v.boolean(),
  sourcePath: v.optional(v.string()),
  title: v.string(),
  contentHash: v.string(),
  syncShard: v.number(),
});

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
  publicRouteSitemapCounts: defineTable({
    count: v.number(),
    hash: v.string(),
    locale: localeValidator,
    pageCount: v.number(),
    syncedAt: v.number(),
  }).index("by_locale", ["locale"]),

  /** Immutable exact paths keyed by locale, generation, and page. */
  publicRouteSitemapPages: defineTable({
    locale: localeValidator,
    page: v.number(),
    paths: v.array(v.string()),
    syncedAt: v.number(),
  }).index("by_locale_and_syncedAt_and_page", ["locale", "syncedAt", "page"]),

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
