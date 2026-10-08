import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import {
  type PublicationScope,
  PublicationScopeSchema,
} from "@nakafa/aksara-contracts/release/snapshot/scope";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  TEST_DIGEST,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
  zeroReleaseJson,
} from "@repo/backend/test/content/state";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr, Effect, Schema } from "effect";

const stageRelease = internal.contentRelease.manifest.stageRelease;
const stageRecovery = internal.contentRelease.manifest.stageRecovery;
const CANDIDATE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-candidate",
  sequence: 1,
} satisfies TestIdentity;
const RECOVERY = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-recovery",
  sequence: 2,
} satisfies TestIdentity;

/** Creates one empty genesis candidate envelope. */
function candidateJson(identity = CANDIDATE, scope?: PublicationScope) {
  return testReleaseJson({
    itemCount: 0,
    scope,
    manifestHash: identity.manifestHash,
    projectionCount: 0,
    releaseId: identity.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    upsertCount: 0,
  });
}

/** Creates the exact inverse envelope for the verified genesis candidate. */
function recoveryJson(
  releaseId = RECOVERY.releaseId,
  scope?: PublicationScope
) {
  return testReleaseJson({
    baseManifestHash: CANDIDATE.manifestHash,
    baseReleaseId: CANDIDATE.releaseId,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 0,
    scope,
    manifestHash: RECOVERY.manifestHash,
    originReleaseId: CANDIDATE.releaseId,
    projectionCount: 0,
    releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    upsertCount: 0,
  });
}

/** Stages and marks the zero-item candidate verified for recovery tests. */
async function stageVerifiedCandidate(
  t: TestConvex<typeof schema>,
  scope?: PublicationScope
) {
  await t.mutation(stageRelease, {
    releaseJson: candidateJson(CANDIDATE, scope),
    rendererJson: testRendererJson(),
  });
  await t.mutation(async (ctx) => {
    const release = await ctx.db.query("contentReleases").unique();
    if (!release) {
      throw new Error("Expected staged candidate.");
    }
    await ctx.db.patch("contentReleases", release._id, {
      proofAt: 1,
      proofJson: "{}",
      status: "verified",
      verifiedAt: 1,
    });
  });
}

describe("contentRelease/manifest", () => {
  it("stages one candidate idempotently and rejects another", async () => {
    const t = convexTest(schema, convexModules);
    const input = {
      releaseJson: candidateJson(),
      rendererJson: testRendererJson(),
    };
    const created = await t.mutation(stageRelease, input);
    const unchanged = await t.mutation(stageRelease, input);

    expect(created).toEqual({
      manifestHash: CANDIDATE.manifestHash,
      phase: "staging",
      releaseId: CANDIDATE.releaseId,
    });
    expect(unchanged).toEqual(created);
    const stored = await t.run(async (ctx) => ({
      release: await ctx.db.query("contentReleases").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.state).toMatchObject({
      candidateReleaseId: CANDIDATE.releaseId,
    });
    expect(stored.release).toMatchObject({
      baseFamilies: [],
      resultFamilies: ContentFamilySchema.literals,
      tryoutRuntimeRequired: true,
    });
    await expect(
      t.mutation(stageRelease, {
        releaseJson: candidateJson({
          ...CANDIDATE,
          manifestHash: `sha256:${"8".repeat(64)}`,
          releaseId: "release-other",
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("stages only an exact inverse for the verified candidate", async () => {
    const t = convexTest(schema, convexModules);
    await stageVerifiedCandidate(t);

    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).resolves.toEqual({
      manifestHash: RECOVERY.manifestHash,
      phase: "staging",
      releaseId: RECOVERY.releaseId,
    });
    const stored = await t.run(async (ctx) => ({
      releases: await ctx.db
        .query("contentReleases")
        .withIndex("by_sequence")
        .collect(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.state).toMatchObject({
      candidateReleaseId: CANDIDATE.releaseId,
      recoveryReleaseId: RECOVERY.releaseId,
    });
    expect(
      Arr.map(stored.releases, ({ baseFamilies, resultFamilies }) => ({
        baseFamilies,
        resultFamilies,
      }))
    ).toEqual([
      {
        baseFamilies: [],
        resultFamilies: ContentFamilySchema.literals,
      },
      {
        baseFamilies: ContentFamilySchema.literals,
        resultFamilies: [],
      },
    ]);
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).resolves.toMatchObject({ phase: "staging" });
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson("release-other-recovery"),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(TEST_DIGEST, "h1"),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects inverse drift and recovery without a candidate", async () => {
    const missing = convexTest(schema, convexModules);
    await expect(
      missing.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const drift = convexTest(schema, convexModules);
    await stageVerifiedCandidate(drift);
    await expect(
      drift.mutation(stageRecovery, {
        releaseJson: testReleaseJson({
          baseManifestHash: CANDIDATE.manifestHash,
          baseReleaseId: CANDIDATE.releaseId,
          baseResultCount: 0,
          baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
          itemCount: 0,
          manifestHash: RECOVERY.manifestHash,
          projectionCount: 0,
          releaseId: RECOVERY.releaseId,
          resultCount: 0,
          resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
          routeCount: 0,
          upsertCount: 0,
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects retries after stored ownership or the candidate slot drifts", async () => {
    const t = convexTest(schema, convexModules);
    const input = {
      releaseJson: candidateJson(),
      rendererJson: testRendererJson(),
    };
    await t.mutation(stageRelease, input);
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      expect(release).not.toBeNull();
      if (release) {
        await ctx.db.patch("contentReleases", release._id, {
          resultFamilies: [],
        });
      }
    });
    await expect(t.mutation(stageRelease, input)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      const state = await ctx.db.query("contentState").unique();
      expect(release).not.toBeNull();
      expect(state).not.toBeNull();
      if (release && state) {
        await ctx.db.patch("contentReleases", release._id, {
          resultFamilies: [...ContentFamilySchema.literals],
        });
        await ctx.db.patch("contentState", state._id, {
          candidateSequence: 100,
        });
      }
    });
    await expect(t.mutation(stageRelease, input)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });

  it("rejects unsupported, oversized, and changed authenticated bytes", async () => {
    const unsupported = convexTest(schema, convexModules);
    await expect(
      unsupported.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(`sha256:${"9".repeat(64)}`),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_UNSUPPORTED" } });

    const oversized = convexTest(schema, convexModules);
    await expect(
      oversized.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(TEST_DIGEST, `A${"a".repeat(540_000)}`),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });

    const changed = convexTest(schema, convexModules);
    await changed.mutation(stageRelease, {
      releaseJson: candidateJson(),
      rendererJson: testRendererJson(),
    });
    await expect(
      changed.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(TEST_DIGEST, "h1"),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("requires the exact active completed base", async () => {
    const stale = convexTest(schema, convexModules);
    const base = {
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId: "release-base",
      sequence: 1,
    } satisfies TestIdentity;
    await stale.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...base,
        ownership: {
          base: [],
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, { active: base, nextSequence: 2 });
    });
    await expect(
      stale.mutation(stageRelease, {
        releaseJson: testReleaseJson({
          baseManifestHash: base.manifestHash,
          baseReleaseId: base.releaseId,
          baseResultCount: 1,
          baseResultDigest: TEST_DIGEST,
          itemCount: 0,
          manifestHash: CANDIDATE.manifestHash,
          projectionCount: 0,
          releaseId: CANDIDATE.releaseId,
          resultCount: 0,
          resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
          routeCount: 0,
          upsertCount: 0,
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STALE_BASE" } });
  });

  it.live.each(["missing", "unverified", "verified"])(
    "validates an inherited %s snapshot before reserving a candidate",
    (status) =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          const base = {
            manifestHash: TEST_DIGEST,
            releaseId: "release-program-base",
            sequence: 1,
          };
          await t.mutation(async (ctx) => {
            await insertZeroRelease(ctx, {
              ...base,
              ownership: { base: [], result: ContentFamilySchema.literals },
              role: "candidate",
              status: "completed",
              snapshots: data.snapshots,
            });
            await insertTestState(ctx, { active: base, nextSequence: 2 });
            if (status !== "missing") {
              await ctx.db.insert("contentSnapshots", {
                createdAt: 1,
                family: "program",
                retainUntil: 2,
                snapshotId: data.snapshotId,
                snapshotJson: data.manifestJson,
                ...(status === "verified" ? { verifiedAt: 1 } : {}),
              });
            }
          });
          const result = t.mutation(stageRelease, {
            releaseJson: zeroReleaseJson({
              ...CANDIDATE,
              sequence: 2,
              base,
              role: "candidate",
              status: "verified",
              snapshots: inheritContentSnapshots(data.snapshots),
            }),
            rendererJson: testRendererJson(),
          });
          if (status === "verified") {
            await expect(result).resolves.toMatchObject({
              phase: "staging",
              releaseId: CANDIDATE.releaseId,
            });
            return;
          }
          await expect(result).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_MISSING" },
          });
          const state = await t.query((ctx) =>
            ctx.db.query("contentState").unique()
          );
          expect(state).toMatchObject({
            activeReleaseId: base.releaseId,
            nextSequence: 2,
          });
          expect(state).not.toHaveProperty("candidateReleaseId");
        });
      })
  );

  it("returns completed idempotently only while it remains active", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...CANDIDATE,
        ownership: {
          base: [],
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, { active: CANDIDATE, nextSequence: 2 });
    });
    const input = {
      releaseJson: zeroReleaseJson({
        ...CANDIDATE,
        role: "candidate",
        status: "completed",
      }),
      rendererJson: testRendererJson(),
    };
    await expect(t.mutation(stageRelease, input)).resolves.toMatchObject({
      phase: "completed",
      releaseId: CANDIDATE.releaseId,
    });
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected active state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: "release-advanced",
      });
    });
    await expect(t.mutation(stageRelease, input)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });
  it("retains the origin's selected snapshot scope in its paired recovery", async () => {
    const t = convexTest(schema, convexModules);
    const scope = PublicationScopeSchema.make({
      families: ContentFamilySchema.literals,
      snapshots: ["program"],
    });
    await stageVerifiedCandidate(t, scope);
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(RECOVERY.releaseId, scope),
        rendererJson: testRendererJson(),
      })
    ).resolves.toMatchObject({
      phase: "staging",
      releaseId: RECOVERY.releaseId,
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentReleases").collect())
    ).toHaveLength(2);
  });

  it("rejects an inverse with a different publication family scope", async () => {
    const t = convexTest(schema, convexModules);
    await stageVerifiedCandidate(t);
    const recovery = Schema.decodeSync(
      Schema.fromJsonString(SignedContentReleaseSchema)
    )(recoveryJson());
    const narrowed = SignedContentReleaseSchema.make({
      ...recovery,
      manifest: {
        ...recovery.manifest,
        scope: { ...recovery.manifest.scope, families: ["article"] },
      },
    });
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: Schema.encodeSync(
          Schema.fromJsonString(SignedContentReleaseSchema)
        )(narrowed),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    await expect(
      t.query((ctx) => ctx.db.query("contentReleases").collect())
    ).resolves.toHaveLength(1);
  });
});
