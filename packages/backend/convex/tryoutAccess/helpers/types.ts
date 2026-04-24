import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";

export type TryoutAccessDbReader = MutationCtx["db"] | QueryCtx["db"];
export type TryoutAccessDbWriter = MutationCtx["db"];
