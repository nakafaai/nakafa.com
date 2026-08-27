import { describe, expect, it } from "@effect/vitest";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type {
  mapEntryValidator,
  targetRuntimeValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  ABORT_MIGRATION_ID,
  seedOwnedAbort,
  seedPendingAbort,
} from "@repo/backend/test/migration/abort";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type MapEntry = Infer<typeof mapEntryValidator>;
type TargetRuntime = Infer<typeof targetRuntimeValidator>;

const mapEntries = makeFunctionReference<
  "query",
  { migrationId: string },
  MapEntry[]
>("tryouts/migration/state/query:mapEntries");
const targetRuntime = makeFunctionReference<
  "query",
  { migrationId: string },
  TargetRuntime
>("tryouts/migration/state/query:targetRuntime");

describe("tryouts/migration/state/query", () => {
  it.effect("projects the staged ledger and immutable runtime", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedOwnedAbort));

      const [entries, runtime] = yield* Effect.all([
        Effect.promise(() =>
          t.query(mapEntries, { migrationId: ABORT_MIGRATION_ID })
        ),
        Effect.promise(() =>
          t.query(targetRuntime, { migrationId: ABORT_MIGRATION_ID })
        ),
      ]);

      expect(entries).toEqual([
        {
          identity: "artifact:owned",
          index: 0,
          kind: "artifact",
          newHash: `sha256:${"3".repeat(64)}`,
          oldHash: `sha256:${"b".repeat(64)}`,
        },
        {
          identity: "artifact:shared",
          index: 1,
          kind: "artifact",
          newHash: `sha256:${"4".repeat(64)}`,
          oldHash: `sha256:${"c".repeat(64)}`,
        },
        {
          identity: "catalog:abort",
          index: 0,
          kind: "catalog",
          newHash: `sha256:${"5".repeat(64)}`,
          oldHash: `sha256:${"9".repeat(64)}`,
        },
        {
          identity: "placement:abort",
          index: 1,
          kind: "placement",
          newHash: `sha256:${"6".repeat(64)}`,
          oldHash: `sha256:${"a".repeat(64)}`,
        },
      ]);
      expect(runtime).toEqual({
        bundleJson: "owned-runtime",
        rendererJson: "owned-renderer",
      });
    })
  );

  it.effect("hides runtime bytes until the migration target is staged", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedPendingAbort));

      const runtime = yield* Effect.promise(() =>
        t.query(targetRuntime, { migrationId: ABORT_MIGRATION_ID })
      );

      expect(runtime).toBeNull();
    })
  );
});
