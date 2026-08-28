import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import type {
  PredecessorObservationArgs,
  PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { PREDECESSOR_QUIET_WINDOW_MS } from "@repo/backend/convex/contentRelease/predecessor/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const MIGRATION_ID = "test-history-migration";
const OBSERVATION_ID = "test-predecessor-observation";
const digest = `sha256:${"a".repeat(64)}`;
type MigrationStatus = Infer<typeof migrationStatusValidator>;

const armObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:arm");
const sealObservation = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:seal");
const beginMigration = makeFunctionReference<
  "mutation",
  { migrationId: string },
  MigrationStatus
>("tryouts/migration/lifecycle:begin");

describe("tryouts/migration/lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.effect("requires sealed predecessor evidence before writes", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const armedAt = Date.UTC(2026, 7, 26, 8);
      vi.setSystemTime(armedAt);
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          await insertRuntimeRelease(ctx);
          await ctx.db.insert("tryoutHistoryMigrations", {
            artifactMapCount: 0,
            authorization: {
              planHash: digest,
              planJson: "{}",
              sourceScaleVersionIds: [],
            },
            catalogMapCount: 0,
            createdAt: armedAt,
            migrationId: MIGRATION_ID,
            phase: "ready",
            placementMapCount: 0,
            sourceSnapshotId: digest,
            target: {
              bundleCreated: false,
              bundleHash: digest,
              kind: "staged",
              snapshotCreated: false,
              snapshotId: digest,
            },
            updatedAt: armedAt,
          });
        })
      );

      yield* Effect.promise(() =>
        expect(
          target.mutation(beginMigration, { migrationId: MIGRATION_ID })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_STATE",
            message: "Predecessor observation is not armed for every route.",
          },
        })
      );

      yield* Effect.promise(() =>
        target.mutation(armObservation, { observationId: OBSERVATION_ID })
      );
      vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
      yield* Effect.promise(() =>
        target.mutation(sealObservation, { observationId: OBSERVATION_ID })
      );

      yield* Effect.promise(() =>
        expect(
          target.mutation(beginMigration, { migrationId: MIGRATION_ID })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Try-out history migration plan violates its wire contract.",
          },
        })
      );
    })
  );
});
