import { publicRouteValidator } from "@repo/backend/convex/contents/publicRoutes/spec";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

const paginatedPublicRoutesValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(publicRouteValidator),
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
export const getPublicRouteByPathReturnValidator =
  nullable(publicRouteValidator);

const listPublicRoutesByParentArgsObjectValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  kind: publicRouteValidator.fields.kind,
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
export const listPublicRoutesByMaterialReturnValidator =
  v.array(publicRouteValidator);
