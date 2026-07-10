import {
  localeValidator,
  materialValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  PROGRAM_NAVIGATION_ICON_KEY_VALUES,
  PROGRAM_NAVIGATION_LEVEL_VALUES,
} from "@repo/contents/_types/program/schema";
import { PUBLIC_ROUTE_KIND_VALUES } from "@repo/contents/_types/route/schema";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const syncSummaryValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

export const deleteResultValidator = v.object({
  deleted: v.number(),
});

const navigationLevelValidator = literals(...PROGRAM_NAVIGATION_LEVEL_VALUES);
const navigationIconKeyValidator = literals(
  ...PROGRAM_NAVIGATION_ICON_KEY_VALUES
);
const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);

/** Canonical public route row written by content sync read-model imports. */
export const publicRouteRowValidator = v.object({
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
});

export type PublicRouteRow = Infer<typeof publicRouteRowValidator>;
export type SyncedPublicRouteRow = PublicRouteRow & { syncedAt: number };
