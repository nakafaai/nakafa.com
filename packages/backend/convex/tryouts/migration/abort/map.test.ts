import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { abortProgram } from "@repo/backend/convex/tryouts/migration/abort";
import {
  ABORT_MIGRATION_ID,
  ABORT_OWNED_ARTIFACT,
  seedOwnedAbort,
} from "@repo/backend/test/migration/abort";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Runs one bounded abort page at the native Convex test boundary. */
function abort(ctx: MutationCtx) {
  return runConvexProgram(abortProgram(ctx, ABORT_MIGRATION_ID));
}

describe("tryouts/migration/abort/map", () => {
  it.effect("rejects staged row mappings owned by a pending target", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedOwnedAbort(ctx);
          const root = await ctx.db.query("tryoutHistoryMigrations").unique();
          if (root) {
            await ctx.db.patch("tryoutHistoryMigrations", root._id, {
              target: { kind: "pending" },
            });
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
          maps: await ctx.db.query("tryoutHistoryMigrationMaps").collect(),
          root: await ctx.db.query("tryoutHistoryMigrations").unique(),
        }))
      );

      expect(state.maps).toHaveLength(4);
      expect(state.root?.phase).toBe("staging");
    })
  );

  it.effect("rejects incoherent catalog and placement targets", () =>
    Effect.gen(function* () {
      for (const kind of ["catalog", "placement"] as const) {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => t.mutation(seedOwnedAbort));
        if (kind === "placement") {
          yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
        }
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            if (kind === "catalog") {
              const row = await ctx.db.query("tryoutCatalog").unique();
              if (row) {
                await ctx.db.patch("tryoutCatalog", row._id, {
                  rowHash: `sha256:${"e".repeat(64)}`,
                });
              }
              return;
            }
            const row = await ctx.db.query("tryoutPlacements").unique();
            if (row) {
              await ctx.db.patch("tryoutPlacements", row._id, {
                rowHash: `sha256:${"f".repeat(64)}`,
              });
            }
          })
        );

        yield* Effect.promise(() =>
          expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        const maps = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("tryoutHistoryMigrationMaps").collect())
        );
        expect(maps.some((mapping) => mapping.kind === kind)).toBe(true);
      }
    })
  );

  it.effect("skips a reused artifact after its owned mapping deletes it", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedOwnedAbort(ctx);
          await ctx.db.insert("tryoutHistoryMigrationMaps", {
            identity: "artifact:owned-reuse",
            index: 2,
            kind: "artifact",
            migrationId: ABORT_MIGRATION_ID,
            newHash: ABORT_OWNED_ARTIFACT,
            oldHash: `sha256:${"d".repeat(64)}`,
            targetCreated: false,
          });
          const root = await ctx.db.query("tryoutHistoryMigrations").unique();
          if (!root) {
            throw new Error("Expected staged abort root.");
          }
          await ctx.db.patch("tryoutHistoryMigrations", root._id, {
            artifactMapCount: 3,
          });
        })
      );

      let result = yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
      while (!result.done) {
        result = yield* Effect.promise(() => t.mutation((ctx) => abort(ctx)));
      }
      const state = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          artifacts: await ctx.db.query("contentArtifacts").collect(),
          maps: await ctx.db.query("tryoutHistoryMigrationMaps").collect(),
          root: await ctx.db.query("tryoutHistoryMigrations").unique(),
        }))
      );

      expect(
        state.artifacts.some(
          ({ artifactHash }) => artifactHash === ABORT_OWNED_ARTIFACT
        )
      ).toBe(false);
      expect(state.maps).toEqual([]);
      expect(state.root).toBeNull();
    })
  );
});
