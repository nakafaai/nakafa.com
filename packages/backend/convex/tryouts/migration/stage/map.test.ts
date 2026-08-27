import { assert, describe, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { stageMapEntry } from "@repo/backend/convex/tryouts/migration/stage/map";
import type { MapInput } from "@repo/backend/convex/tryouts/migration/stage/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const MIGRATION_ID = "migration-map-test";
const OLD_HASH = `sha256:${"1".repeat(64)}`;
const NEW_HASH = `sha256:${"2".repeat(64)}`;

describe("tryouts/migration/stage/map", () => {
  it.effect("stores only mapping facts and proves an exact retry", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const entry = {
        artifactJson: "authenticated bytes belong outside the map table",
        identity: OLD_HASH,
        index: 0,
        kind: "artifact",
        newHash: NEW_HASH,
        oldHash: OLD_HASH,
      } satisfies MapInput;
      const first = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(stageMapEntry(ctx, MIGRATION_ID, entry, true))
        )
      );
      const second = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          runConvexProgram(stageMapEntry(ctx, MIGRATION_ID, entry, false))
        )
      );
      const stored = yield* Effect.promise(() =>
        t.query((ctx) =>
          ctx.db
            .query("tryoutHistoryMigrationMaps")
            .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
              query
                .eq("migrationId", MIGRATION_ID)
                .eq("kind", "artifact")
                .eq("oldHash", OLD_HASH)
            )
            .unique()
        )
      );

      assert.strictEqual(first, false);
      assert.strictEqual(second, true);
      assert.ok(stored);
      assert.deepStrictEqual(
        {
          identity: stored.identity,
          index: stored.index,
          kind: stored.kind,
          migrationId: stored.migrationId,
          newHash: stored.newHash,
          oldHash: stored.oldHash,
          targetCreated: stored.targetCreated,
        },
        {
          identity: OLD_HASH,
          index: 0,
          kind: "artifact",
          migrationId: MIGRATION_ID,
          newHash: NEW_HASH,
          oldHash: OLD_HASH,
          targetCreated: true,
        }
      );
      assert.strictEqual("artifactJson" in stored, false);
      assert.strictEqual("rowJson" in stored, false);
    })
  );
});
