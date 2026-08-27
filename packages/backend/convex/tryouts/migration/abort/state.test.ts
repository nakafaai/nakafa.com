import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { abortProgram } from "@repo/backend/convex/tryouts/migration/abort";
import {
  loadAbortState,
  validateAbortFinalState,
  validateAbortProgress,
} from "@repo/backend/convex/tryouts/migration/abort/state";
import {
  ABORT_MIGRATION_ID,
  ABORT_SOURCE_SNAPSHOT,
  seedOwnedAbort,
  seedPendingAbort,
} from "@repo/backend/test/migration/abort";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Runs the abort state lookup at the native Convex test boundary. */
function load(ctx: MutationCtx, migrationId = ABORT_MIGRATION_ID) {
  return runConvexProgram(loadAbortState(ctx, migrationId));
}

describe("tryouts/migration/abort/state", () => {
  it.effect("rejects duplicate and mixed abort roots", () =>
    Effect.gen(function* () {
      const duplicate = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        duplicate.mutation(async (ctx) => {
          await seedPendingAbort(ctx);
          await seedPendingAbort(ctx);
        })
      );
      yield* Effect.promise(() =>
        expect(duplicate.mutation((ctx) => load(ctx))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );

      const mixed = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        mixed.mutation(async (ctx) => {
          await seedPendingAbort(ctx);
          await ctx.db.insert("tryoutHistoryMigrationAborts", {
            abortedAt: 1,
            deleted: 1,
            migrationId: ABORT_MIGRATION_ID,
            sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(mixed.mutation((ctx) => load(ctx))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );

  it.effect("refuses foreign root and tombstone owners", () =>
    Effect.gen(function* () {
      const root = convexTest(schema, convexModules);
      yield* Effect.promise(() => root.mutation(seedPendingAbort));
      yield* Effect.promise(() =>
        expect(
          root.mutation((ctx) => load(ctx, "foreign"))
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );

      const tombstone = convexTest(schema, convexModules);
      yield* Effect.promise(() => tombstone.mutation(seedPendingAbort));
      yield* Effect.promise(() =>
        tombstone.mutation((ctx) =>
          runConvexProgram(abortProgram(ctx, ABORT_MIGRATION_ID))
        )
      );
      yield* Effect.promise(() =>
        expect(
          tombstone.mutation((ctx) => load(ctx, "foreign"))
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
    })
  );

  it.effect("rejects progress beyond the signed abort inventory", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedOwnedAbort));
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(abortProgram(ctx, ABORT_MIGRATION_ID))
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation(async (ctx) => {
            const root = await ctx.db.query("tryoutHistoryMigrations").unique();
            if (root?.phase !== "aborting") {
              return;
            }
            return runConvexProgram(
              validateAbortProgress(
                root,
                Number.MAX_SAFE_INTEGER,
                root.abort.maps
              )
            );
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it.effect("rejects lost mappings and terminal residue", () =>
    Effect.gen(function* () {
      const missing = convexTest(schema, convexModules);
      yield* Effect.promise(() => missing.mutation(seedOwnedAbort));
      yield* Effect.promise(() =>
        missing.mutation((ctx) =>
          runConvexProgram(abortProgram(ctx, ABORT_MIGRATION_ID))
        )
      );
      yield* Effect.promise(() =>
        expect(
          missing.mutation(async (ctx) => {
            const root = await ctx.db.query("tryoutHistoryMigrations").unique();
            if (root?.phase !== "aborting") {
              return;
            }
            return runConvexProgram(validateAbortFinalState(ctx, root));
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );

      const residue = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        residue.mutation(async (ctx) => {
          const rootId = await seedPendingAbort(ctx);
          await ctx.db.patch("tryoutHistoryMigrations", rootId, {
            abort: {
              deleted: 0,
              maps: { artifact: 0, catalog: 0, placement: 0 },
            },
            phase: "aborting",
          });
          await ctx.db.insert("tryoutHistoryMigrationMaps", {
            identity: "artifact:residue",
            index: 0,
            kind: "artifact",
            migrationId: "residue",
            newHash: `sha256:${"d".repeat(64)}`,
            oldHash: `sha256:${"e".repeat(64)}`,
            targetCreated: false,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(
          residue.mutation(async (ctx) => {
            const root = await ctx.db.query("tryoutHistoryMigrations").unique();
            if (root?.phase !== "aborting") {
              return;
            }
            return runConvexProgram(validateAbortFinalState(ctx, root));
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );
});
