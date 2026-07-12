import { publicRouteValidator } from "@repo/backend/convex/contents/publicRoutes/spec";
import { type Infer, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Fixed shard count supporting bounded updates for multi-million route sets. */
export const PUBLIC_ROUTE_SHARD_COUNT = 16_384;
export const PUBLIC_ROUTE_ROOT_SHARD = -1;
export const PUBLIC_ROUTE_SYNC_VERSION = 1;

export const publicRouteSyncRowValidator = v.object({
  ...publicRouteValidator.fields,
  contentHash: v.string(),
});

export const publicRouteShardValidator = v.object({
  hash: v.string(),
  routes: v.array(publicRouteSyncRowValidator),
  shard: v.number(),
});

export const publicRouteSyncStateValidator = v.object({
  hash: v.string(),
  rowCount: v.number(),
  shard: v.number(),
});

export const publicRouteSyncStatePageValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(publicRouteSyncStateValidator),
});

export const publicRouteSyncStateReturnValidator = nullable(
  publicRouteSyncStateValidator
);

export const publicRouteSyncResultValidator = v.object({
  created: v.number(),
  deleted: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

export type PublicRouteShard = Infer<typeof publicRouteShardValidator>;
export type PublicRouteSyncRow = Infer<typeof publicRouteSyncRowValidator>;
export type PublicRouteSyncState = Infer<typeof publicRouteSyncStateValidator>;
