import { describe, expect, it } from "@effect/vitest";
import {
  hasSnapshotArtifactReference,
  isSnapshotReferenced,
} from "@repo/backend/convex/contentRelease/snapshot/retention";
import { tryoutPlacementFacts } from "@repo/backend/convex/contentRelease/tryout/facts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { initialCleanupState } from "@repo/backend/convex/tryouts/migration/cleanup/count";
import { TEST_ARTIFACT_HASH } from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import {
  TEST_STORED_TRYOUT_PLACEMENT,
  TEST_STORED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/test/tryout/history";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import {
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/snapshot/retention", () => {
  it.effect(
    "protects snapshots selected by publication slots and recent history",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const candidate = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          candidate.mutation((ctx) =>
            insertTestRelease(ctx, { snapshots: data.snapshots })
          )
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              runConvexProgram(
                isSnapshotReferenced(ctx, "program", data.snapshotId)
              )
            )
          ).resolves.toBe(true)
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              runConvexProgram(
                isSnapshotReferenced(ctx, "program", `sha256:${"9".repeat(64)}`)
              )
            )
          ).resolves.toBe(false)
        );

        yield* Effect.promise(() =>
          candidate.mutation(async (ctx) => {
            const [release, state] = await Promise.all([
              ctx.db.query("contentReleases").unique(),
              ctx.db.query("contentState").unique(),
            ]);
            if (!(release && state)) {
              throw new Error("Expected candidate snapshot release.");
            }
            await ctx.db.patch("contentReleases", release._id, {
              completedAt: 1,
              status: "completed",
            });
            await ctx.db.patch("contentState", state._id, {
              candidateManifestHash: undefined,
              candidateReleaseId: undefined,
              candidateSequence: undefined,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            candidate.mutation((ctx) =>
              runConvexProgram(
                isSnapshotReferenced(ctx, "program", data.snapshotId)
              )
            )
          ).resolves.toBe(true)
        );
      })
  );

  it("finds question and answer artifacts retained by try-out placements", async () => {
    const t = convexTest(schema, convexModules);
    const answerHash = `sha256:${"3".repeat(64)}`;
    const placement = makeTryoutPlacementRow().record;
    await t.mutation((ctx) =>
      ctx.db.insert("tryoutPlacements", {
        ...tryoutPlacementFacts(placement),
        answerArtifactHash: answerHash,
        index: 0,
        questionArtifactHash: TEST_ARTIFACT_HASH,
        rowHash: placement.rowHash,
        rowJson: "{}",
        snapshotId: `sha256:${"5".repeat(64)}`,
      })
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(hasSnapshotArtifactReference(ctx, TEST_ARTIFACT_HASH))
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(hasSnapshotArtifactReference(ctx, answerHash))
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          hasSnapshotArtifactReference(ctx, `sha256:${"6".repeat(64)}`)
        )
      )
    ).resolves.toBe(false);
  });

  it("finds artifacts retained by isolated try-out history", async () => {
    const t = convexTest(schema, convexModules);
    const placement = TEST_STORED_TRYOUT_PLACEMENT.record;
    await t.mutation((ctx) =>
      ctx.db.insert("tryoutHistoryRows", {
        answerArtifactHash: placement.row.answerArtifactHash,
        index: 0,
        questionArtifactHash: placement.row.questionArtifactHash,
        rowHash: placement.rowHash,
        rowJson: JSON.stringify(TEST_STORED_TRYOUT_PLACEMENT),
        rowKind: "placement",
        snapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
      })
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          hasSnapshotArtifactReference(ctx, placement.row.questionArtifactHash)
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          hasSnapshotArtifactReference(ctx, placement.row.answerArtifactHash)
        )
      )
    ).resolves.toBe(true);
  });

  it("protects migration source and target artifacts until owned cleanup", async () => {
    const t = convexTest(schema, convexModules);
    const oldHash = `sha256:${"8".repeat(64)}`;
    const newHash = `sha256:${"9".repeat(64)}`;
    const migrationId = "artifact-retention-migration";
    const rootId = await t.mutation(async (ctx) => {
      const root = await ctx.db.insert("tryoutHistoryMigrations", {
        artifactMapCount: 1,
        catalogMapCount: 0,
        createdAt: 1,
        migrationId,
        phase: "staging",
        placementMapCount: 0,
        sourceSnapshotId: `sha256:${"a".repeat(64)}`,
        target: {
          bundleCreated: false,
          bundleHash: `sha256:${"b".repeat(64)}`,
          kind: "staged",
          snapshotCreated: false,
          snapshotId: `sha256:${"c".repeat(64)}`,
        },
        updatedAt: 1,
      });
      await ctx.db.insert("tryoutHistoryMigrationMaps", {
        identity: oldHash,
        index: 0,
        kind: "artifact",
        migrationId,
        newHash,
        oldHash,
        targetCreated: false,
      });
      return root;
    });

    for (const artifactHash of [oldHash, newHash]) {
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(hasSnapshotArtifactReference(ctx, artifactHash))
        )
      ).resolves.toBe(true);
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(
            hasSnapshotArtifactReference(ctx, artifactHash, {
              ignoredMigrationId: migrationId,
            })
          )
        )
      ).resolves.toBe(false);
    }

    await t.mutation((ctx) => ctx.db.delete("tryoutHistoryMigrations", rootId));
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(hasSnapshotArtifactReference(ctx, oldHash))
      )
    ).resolves.toBe(false);
  });

  it("protects try-out snapshots referenced by attempts and IRT scales", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "snapshot-retention",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        scoringStrategy: "irt",
        userId: identity.userId,
        visibility: "visible",
      });
      return { fixture, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });
    await authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      setKey: TRYOUT_START_SET,
      trackKey: TRYOUT_START_TRACK,
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          isSnapshotReferenced(ctx, "tryout", seeded.fixture.snapshotId)
        )
      )
    ).resolves.toBe(true);

    const scaleSnapshotId = `sha256:${"7".repeat(64)}`;
    await t.mutation(async (ctx) => {
      await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: TRYOUT_START_NOW,
        questionCount: 1,
        setIdentity: seeded.fixture.setIdentity,
        status: "provisional",
        tryoutSnapshotId: scaleSnapshotId,
      });
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(isSnapshotReferenced(ctx, "tryout", scaleSnapshotId))
      )
    ).resolves.toBe(true);
  });

  it("protects every staged migration target until its root is removed", async () => {
    const t = convexTest(schema, convexModules);
    const phases = [
      "staging",
      "ready",
      "running",
      "completed",
      "cleaning",
    ] as const;
    const snapshots = phases.map((phase, index) => ({
      phase,
      sourceSnapshotId: `sha256:${String.fromCharCode(97 + index).repeat(64)}`,
      snapshotId: `sha256:${(index + 1).toString().repeat(64)}`,
    }));
    await t.mutation(async (ctx) => {
      for (const [
        index,
        { phase, snapshotId, sourceSnapshotId },
      ] of snapshots.entries()) {
        const target = {
          bundleCreated: false,
          bundleHash: `sha256:${(index + 6).toString().repeat(64)}`,
          kind: "staged",
          snapshotCreated: false,
          snapshotId,
        } satisfies {
          readonly bundleCreated: boolean;
          readonly bundleHash: string;
          readonly kind: "staged";
          readonly snapshotCreated: boolean;
          readonly snapshotId: string;
        };
        const base = {
          artifactMapCount: 1,
          catalogMapCount: 1,
          createdAt: 1,
          migrationId: `migration-retention-${phase}`,
          placementMapCount: 1,
          sourceSnapshotId,
          target,
          updatedAt: 2,
        };
        const authorization = {
          planHash: `sha256:${"e".repeat(64)}`,
          planJson: "{}",
          sourceScaleVersionIds: [],
        };
        const progress = {
          migratedAttempts: 0,
          migratedScaleItems: 0,
          migratedScaleRuns: 0,
          migratedScaleVersions: 0,
        };
        if (phase === "staging") {
          await ctx.db.insert("tryoutHistoryMigrations", {
            ...base,
            phase,
          });
        } else if (phase === "ready") {
          await ctx.db.insert("tryoutHistoryMigrations", {
            ...base,
            authorization,
            phase,
          });
        } else if (phase === "running") {
          await ctx.db.insert("tryoutHistoryMigrations", {
            ...base,
            authorization,
            phase,
            predecessorObservationId: "retention-observation",
            progress,
          });
        } else if (phase === "completed") {
          await ctx.db.insert("tryoutHistoryMigrations", {
            ...base,
            authorization,
            completion: { ...progress, cleanupLimit: 0, completedAt: 3 },
            phase,
            predecessorObservationId: "retention-observation",
          });
        } else {
          await ctx.db.insert("tryoutHistoryMigrations", {
            ...base,
            authorization,
            cleanup: initialCleanupState(4),
            completion: { ...progress, cleanupLimit: 0, completedAt: 3 },
            phase,
            predecessorObservationId: "retention-observation",
          });
        }
      }
    });

    for (const { phase, snapshotId, sourceSnapshotId } of snapshots) {
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(isSnapshotReferenced(ctx, "tryout", snapshotId))
        )
      ).resolves.toBe(true);
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(
            isSnapshotReferenced(ctx, "tryout", sourceSnapshotId)
          )
        )
      ).resolves.toBe(true);
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(
            isSnapshotReferenced(ctx, "tryout", sourceSnapshotId, {
              ignoredMigrationId: `migration-retention-${phase}`,
            })
          )
        )
      ).resolves.toBe(false);
    }

    await t.mutation(async (ctx) => {
      for (const root of await ctx.db
        .query("tryoutHistoryMigrations")
        .collect()) {
        await ctx.db.delete("tryoutHistoryMigrations", root._id);
      }
    });
    for (const { snapshotId } of snapshots) {
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(isSnapshotReferenced(ctx, "tryout", snapshotId))
        )
      ).resolves.toBe(false);
    }
  });
});

import { api } from "@repo/backend/convex/_generated/api";
