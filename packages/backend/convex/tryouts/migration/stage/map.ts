import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { MapInput } from "@repo/backend/convex/tryouts/migration/stage/schema";
import { Effect } from "effect";

/** Inserts one map identity or proves an exact idempotent retry. */
export const stageMapEntry = Effect.fn("tryouts.migration.stageMapEntry")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    entry: MapInput,
    targetCreated: boolean
  ) {
    const [byOldHash, byIndex] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryMigrationMaps")
          .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
            query
              .eq("migrationId", migrationId)
              .eq("kind", entry.kind)
              .eq("oldHash", entry.oldHash)
          )
          .unique()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryMigrationMaps")
          .withIndex("by_migrationId_and_kind_and_index", (query) =>
            query
              .eq("migrationId", migrationId)
              .eq("kind", entry.kind)
              .eq("index", entry.index)
          )
          .unique()
      ),
    ]);
    if (byOldHash || byIndex) {
      if (
        !(byOldHash && byIndex) ||
        byOldHash._id !== byIndex._id ||
        byOldHash.identity !== entry.identity ||
        byOldHash.index !== entry.index ||
        byOldHash.newHash !== entry.newHash ||
        byIndex.oldHash !== entry.oldHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Try-out history ${entry.kind} mapping changed immutable identity.`
        );
      }
      return true;
    }
    yield* Effect.promise(() =>
      ctx.db.insert("tryoutHistoryMigrationMaps", {
        identity: entry.identity,
        index: entry.index,
        kind: entry.kind,
        migrationId,
        newHash: entry.newHash,
        oldHash: entry.oldHash,
        targetCreated,
      })
    );
    return false;
  }
);
