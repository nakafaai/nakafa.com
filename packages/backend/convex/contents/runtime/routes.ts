import {
  localeValidator,
  materialValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { PROGRAM_NAVIGATION_ICON_KEY_VALUES } from "@repo/contents/_types/program/schema";
import { PUBLIC_ROUTE_KIND_VALUES } from "@repo/contents/_types/route/schema";
import { type Infer, v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

const publicRouteKindValidator = literals(...PUBLIC_ROUTE_KIND_VALUES);
const navigationIconKeyValidator = literals(
  ...PROGRAM_NAVIGATION_ICON_KEY_VALUES
);

const runtimePublicRouteValidator = v.object({
  canonicalPath: v.optional(v.string()),
  description: v.optional(v.string()),
  displayGroupIconKey: v.optional(navigationIconKeyValidator),
  displayGroupTitle: v.optional(v.string()),
  iconKey: v.optional(navigationIconKeyValidator),
  kind: publicRouteKindValidator,
  locale: localeValidator,
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
  syncedAt: v.number(),
  title: v.string(),
});

const paginatedPublicRoutesValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(runtimePublicRouteValidator),
});

const getPublicRouteByPathArgsObjectValidator = v.object({
  locale: localeValidator,
  publicPath: v.string(),
});

export const getPublicRouteByPathArgsValidator =
  getPublicRouteByPathArgsObjectValidator.fields;
export type GetPublicRouteByPathArgs = Infer<
  typeof getPublicRouteByPathArgsObjectValidator
>;
export const getPublicRouteByPathReturnValidator = nullable(
  runtimePublicRouteValidator
);

const listPublicRoutesByParentArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  kind: publicRouteKindValidator,
  limit: v.number(),
  locale: localeValidator,
  parentPath: v.optional(v.string()),
  programKey: v.optional(v.string()),
});

export const listPublicRoutesByParentArgsValidator =
  listPublicRoutesByParentArgsObjectValidator.fields;
export type ListPublicRoutesByParentArgs = Infer<
  typeof listPublicRoutesByParentArgsObjectValidator
>;
export const listPublicRoutesPageReturnValidator =
  paginatedPublicRoutesValidator;

const listPublicRoutesByMaterialArgsObjectValidator = v.object({
  limit: v.number(),
  locale: localeValidator,
  materialKey: v.string(),
});

export const listPublicRoutesByMaterialArgsValidator =
  listPublicRoutesByMaterialArgsObjectValidator.fields;
export type ListPublicRoutesByMaterialArgs = Infer<
  typeof listPublicRoutesByMaterialArgsObjectValidator
>;
export const listPublicRoutesByMaterialReturnValidator = v.array(
  runtimePublicRouteValidator
);

const listSitemapPublicRoutesArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  limit: v.number(),
  locale: localeValidator,
});

export const listSitemapPublicRoutesArgsValidator =
  listSitemapPublicRoutesArgsObjectValidator.fields;
export type ListSitemapPublicRoutesArgs = Infer<
  typeof listSitemapPublicRoutesArgsObjectValidator
>;
export const listSitemapPublicRoutesReturnValidator =
  paginatedPublicRoutesValidator;
