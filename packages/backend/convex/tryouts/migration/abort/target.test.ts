import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { abortProgram } from "@repo/backend/convex/tryouts/migration/abort";
import {
  ABORT_MIGRATION_ID,
  seedOwnedAbort,
} from "@repo/backend/test/migration/abort";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Runs one bounded abort page at the native Convex test boundary. */
function abort(ctx: MutationCtx) {
  return runConvexProgram(abortProgram(ctx, ABORT_MIGRATION_ID));
}

describe("tryouts/migration/abort/target", () => {
  it.effect("rejects an incoherent runtime without finalizing", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedOwnedAbort));
      for (let page = 0; page < 3; page += 1) {
        yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
      }
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await ctx.db.query("tryoutRuntimeBundles").unique();
          if (runtime) {
            await ctx.db.delete("tryoutRuntimeBundles", runtime._id);
          }
        })
      );

      yield* Effect.promise(() =>
        expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          root: await ctx.db.query("tryoutHistoryMigrations").unique(),
          snapshot: await ctx.db.query("contentSnapshots").unique(),
          tombstone: await ctx.db
            .query("tryoutHistoryMigrationAborts")
            .unique(),
        }))
      );

      expect(state.root?.phase).toBe("aborting");
      expect(state.snapshot).not.toBeNull();
      expect(state.tombstone).toBeNull();
    })
  );

  it.effect("rolls runtime deletion back when its snapshot is missing", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedOwnedAbort));
      for (let page = 0; page < 3; page += 1) {
        yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
      }
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const snapshot = await ctx.db.query("contentSnapshots").unique();
          if (snapshot) {
            await ctx.db.delete("contentSnapshots", snapshot._id);
          }
        })
      );

      yield* Effect.promise(() =>
        expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          root: await ctx.db.query("tryoutHistoryMigrations").unique(),
          runtime: await ctx.db.query("tryoutRuntimeBundles").unique(),
          tombstone: await ctx.db
            .query("tryoutHistoryMigrationAborts")
            .unique(),
        }))
      );

      expect(state.root?.phase).toBe("aborting");
      expect(state.runtime).not.toBeNull();
      expect(state.tombstone).toBeNull();
    })
  );
});
