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

const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);
const navigationIconKeyValidator = literals(
  ...PROGRAM_NAVIGATION_ICON_KEY_VALUES
);
const navigationLevelValidator = literals(...PROGRAM_NAVIGATION_LEVEL_VALUES);

/** Learner-facing fields shared by stored and returned public route rows. */
export const publicRouteValidator = v.object({
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

/** Stored public route fields, including sync-only hash and shard metadata. */
export const storedPublicRouteValidator = v.object({
  ...publicRouteValidator.fields,
  contentHash: v.string(),
  syncShard: v.number(),
});

export type PublicRouteRow = Infer<typeof publicRouteValidator>;
export type StoredPublicRoute = Infer<typeof storedPublicRouteValidator>;
