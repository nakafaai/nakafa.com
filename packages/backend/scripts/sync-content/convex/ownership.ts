import { internal } from "@repo/backend/convex/_generated/api";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex/client";
import { Effect, Schema } from "effect";

const ContentSyncOwnershipSchema = Schema.Struct({
  tryoutsManaged: Schema.Boolean,
});
export type ContentSyncOwnership = Schema.Schema.Type<
  typeof ContentSyncOwnershipSchema
>;

/** Reads the signed publication ownership that governs legacy sync phases. */
export const readContentSyncOwnership = Effect.fn(
  "sync.readContentSyncOwnership"
)(function* (config: ConvexConfig) {
  return yield* callConvexQuery(
    config,
    internal.contentSync.queries.ownership.read,
    {},
    ContentSyncOwnershipSchema
  );
});
