import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import {
  type ContentSnapshotSet,
  inheritContentSnapshot,
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  CURRENT_CONTENT_GENERATION,
  type contentGenerationValidator,
  isBootstrapCandidate,
  RETIRED_CONTENT_GENERATION,
  requireCurrentArtifact,
  requireCurrentRelease,
} from "@repo/backend/confect/contentRelease/generation";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  BOOTSTRAP_RECOVERY,
  seedRetiredCandidate,
} from "@repo/backend/test/activation/fixture";
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
import { JsonTextSchema } from "@repo/utilities/json";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

const ARTIFACT_HASH = `sha256:${"a".repeat(64)}`;
const IDENTITY = "release-test/0/prior";
const RELEASE_ID = "release-retired";

/** One artifact signed under the retired Aksara 0.51 contract, with the exact fields that contract stored. */
const RETIRED_ARTIFACT = `{
  "artifactHash": "${ARTIFACT_HASH}",
  "keyId": "retired-key",
  "payload": {
    "artifactLocale": "en",
    "byteLength": 33,
    "compiledCode": "function Body() { return null; }",
    "compilerConfigHash": "${ARTIFACT_HASH}",
    "compilerVersion": "0.1.0",
    "contentKey": "program:retired",
    "format": "mdx-function-body",
    "mdxCompilerVersion": "3.1.1",
    "plainText": "Retired body",
    "rawMdx": "Retired body",
    "rendererDomain": "biology",
    "requiredComponents": ["InlineMath"],
    "sourceHash": "${ARTIFACT_HASH}"
  },
  "signature": "${"A".repeat(86)}"
}`;

describe("contentRelease/generation", () => {
  it.live("accepts stored artifacts the current contract can read", () =>
    Effect.gen(function* () {
      for (const artifact of [
        null,
        [],
        {},
        { payload: 3 },
        { payload: {} },
        { payload: { format: "content-tree" } },
        { payload: { format: "other-format" } },
        { payload: { requiredComponents: "InlineMath" } },
        { payload: { requiredComponents: [] } },
        { payload: { requiredComponents: ["InlineMath"] } },
        { payload: { requiredComponents: [null] } },
        { payload: { requiredComponents: [{ name: "InlineMath" }] } },
      ]) {
        yield* requireCurrentArtifact(artifact, IDENTITY, ARTIFACT_HASH);
      }
    })
  );

  it.live(
    "rejects an artifact signed in the retired compiled-body format",
    () =>
      Effect.gen(function* () {
        const artifact =
          yield* Schema.decodeEffect(JsonTextSchema)(RETIRED_ARTIFACT);
        const retired = yield* requireCurrentArtifact(
          artifact,
          IDENTITY,
          ARTIFACT_HASH
        ).pipe(Effect.flip);

        expect(retired).toMatchObject({
          code: "CONTENT_RELEASE_UNSUPPORTED",
          message: `Rollback state ${IDENTITY} cannot read artifact ${ARTIFACT_HASH}, which was signed under a retired content contract. Publish a new release instead of rolling back across the contract change.`,
        });
      })
  );

  it.live("rejects an artifact whose components carry versions", () =>
    Effect.gen(function* () {
      const retired = yield* requireCurrentArtifact(
        {
          payload: { requiredComponents: [{ name: "InlineMath", version: 1 }] },
        },
        IDENTITY,
        ARTIFACT_HASH
      ).pipe(Effect.flip);

      expect(retired).toMatchObject({
        code: "CONTENT_RELEASE_UNSUPPORTED",
        message: `Rollback state ${IDENTITY} cannot read artifact ${ARTIFACT_HASH}, which was signed under a retired content contract. Publish a new release instead of rolling back across the contract change.`,
      });
    })
  );

  it.live("accepts stored releases the current contract can read", () =>
    Effect.gen(function* () {
      for (const source of [
        "{",
        "3",
        "{}",
        '{"manifest":"current"}',
        '{"manifest":{}}',
        '{"manifest":{"rendererContractVersion":1}}',
      ]) {
        yield* requireCurrentRelease(source, RELEASE_ID);
      }
    })
  );

  it.live("rejects a release that declares a renderer contract version", () =>
    Effect.gen(function* () {
      const retired = yield* requireCurrentRelease(
        '{"manifest":{"rendererContractVersion":"1.0.0"}}',
        RELEASE_ID
      ).pipe(Effect.flip);

      expect(retired).toMatchObject({
        code: "CONTENT_RELEASE_UNSUPPORTED",
        message: `Content release ${RELEASE_ID} was signed under a retired content contract, so this deployment cannot read it. Republish the content to inspect that release again.`,
      });
    })
  );
});

const stageRelease = internal.contentRelease.manifest.stageRelease;
const stageRecovery = internal.contentRelease.manifest.stageRecovery;
const RETIRED_BASE = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-retired-base",
  sequence: 1,
} satisfies TestIdentity;
const BOOTSTRAP = {
  manifestHash: `sha256:${"c".repeat(64)}`,
  releaseId: "release-bootstrap",
  sequence: 2,
} satisfies TestIdentity;

/** Creates the signed candidate over the retired base; its result holds only the two upserted heads. */
function bootstrapJson(
  options: {
    readonly baseReleaseId?: string;
    readonly resultCount?: number;
    readonly snapshots?: ContentSnapshotSet;
  } = {}
) {
  return testReleaseJson({
    baseManifestHash: RETIRED_BASE.manifestHash,
    baseReleaseId: options.baseReleaseId ?? RETIRED_BASE.releaseId,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 2,
    manifestHash: BOOTSTRAP.manifestHash,
    releaseId: BOOTSTRAP.releaseId,
    resultCount: options.resultCount ?? 2,
    snapshots: options.snapshots,
    upsertCount: 2,
  });
}

/** Replaces every snapshot family with one new snapshot, as a full rebuild does. */
function replacedSnapshots(): ContentSnapshotSet {
  const replaced = replaceContentSnapshot({
    baseSnapshotId: null,
    resultSnapshotId: TEST_DIGEST,
    rowCount: 1,
    rowDigest: TEST_DIGEST,
  });
  return { program: replaced, quran: replaced, tryout: replaced };
}

/**
 * Seeds the completed retired base as the active release. A null generation
 * leaves the active release's generation unrecorded.
 */
async function seedRetiredBase(
  t: TestConvex<typeof schema>,
  generation:
    | typeof RETIRED_CONTENT_GENERATION
    | typeof CURRENT_CONTENT_GENERATION
    | null
) {
  await t.mutation(async (ctx) => {
    await insertZeroRelease(ctx, {
      ...RETIRED_BASE,
      ownership: { base: [], result: ContentFamilySchema.literals },
      role: "candidate",
      status: "completed",
    });
    await insertTestState(ctx, {
      active: RETIRED_BASE,
      generation,
      nextSequence: 2,
    });
  });
}

/** Reads one stored release by its identity. */
function readRelease(t: TestConvex<typeof schema>, releaseId: string) {
  return t.run((ctx) =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
      .unique()
  );
}

/** The zero-item inverse of a candidate over the retired base, which restores the empty catalog it replaced. */
function recoveryJson() {
  return zeroReleaseJson({
    ...BOOTSTRAP_RECOVERY,
    base: BOOTSTRAP,
    originKind: "rollback",
    originReleaseId: BOOTSTRAP.releaseId,
    role: "recovery",
    status: "verified",
  });
}

describe("contentRelease/generation staging", () => {
  it("marks a full replacement of the retired generation as a bootstrap", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, RETIRED_CONTENT_GENERATION);

    await expect(
      t.mutation(stageRelease, {
        releaseJson: bootstrapJson(),
        rendererJson: testRendererJson(),
      })
    ).resolves.toEqual({
      manifestHash: BOOTSTRAP.manifestHash,
      phase: "staging",
      releaseId: BOOTSTRAP.releaseId,
    });
    await expect(readRelease(t, BOOTSTRAP.releaseId)).resolves.toMatchObject({
      bootstrap: true,
      status: "staging",
    });
  });

  it("marks a full replacement of every snapshot family as a bootstrap", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, RETIRED_CONTENT_GENERATION);

    await t.mutation(stageRelease, {
      releaseJson: bootstrapJson({ snapshots: replacedSnapshots() }),
      rendererJson: testRendererJson(),
    });

    await expect(readRelease(t, BOOTSTRAP.releaseId)).resolves.toMatchObject({
      bootstrap: true,
      status: "staging",
    });
  });

  it("stages a full replacement over a current generation as an ordinary candidate", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, CURRENT_CONTENT_GENERATION);

    await t.mutation(stageRelease, {
      releaseJson: bootstrapJson(),
      rendererJson: testRendererJson(),
    });

    const release = await readRelease(t, BOOTSTRAP.releaseId);
    expect(release).toMatchObject({ role: "candidate", status: "staging" });
    expect(release).not.toHaveProperty("bootstrap");
  });

  it("refuses a full replacement over an unrecorded generation", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, null);

    await expect(
      t.mutation(stageRelease, {
        releaseJson: bootstrapJson(),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("is not recorded"),
      },
    });
    await expect(readRelease(t, BOOTSTRAP.releaseId)).resolves.toBeNull();
  });

  it("refuses a partial replacement of the retired generation", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, RETIRED_CONTENT_GENERATION);

    await expect(
      t.mutation(stageRelease, {
        releaseJson: bootstrapJson({ resultCount: 3 }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("retired content generation"),
      },
    });
    await expect(readRelease(t, BOOTSTRAP.releaseId)).resolves.toBeNull();
  });

  it("requires a bootstrap to extend the exact active retired release", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, RETIRED_CONTENT_GENERATION);

    await expect(
      t.mutation(stageRelease, {
        releaseJson: bootstrapJson({ baseReleaseId: "release-other-base" }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STALE_BASE" } });
    await expect(readRelease(t, BOOTSTRAP.releaseId)).resolves.toBeNull();
  });

  it.live(
    "stages a bootstrap that inherits the unchanged program snapshot",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          await t.mutation(async (ctx) => {
            await insertZeroRelease(ctx, {
              ...RETIRED_BASE,
              ownership: { base: [], result: ContentFamilySchema.literals },
              role: "candidate",
              snapshots: data.snapshots,
              status: "completed",
            });
            await ctx.db.insert("contentSnapshots", {
              createdAt: 1,
              family: "program",
              retainUntil: 2,
              snapshotId: data.snapshotId,
              snapshotJson: data.manifestJson,
              verifiedAt: 1,
            });
            await insertTestState(ctx, {
              active: RETIRED_BASE,
              generation: RETIRED_CONTENT_GENERATION,
              nextSequence: 2,
            });
          });

          await expect(
            t.mutation(stageRelease, {
              releaseJson: zeroReleaseJson({
                ...BOOTSTRAP,
                base: RETIRED_BASE,
                role: "candidate",
                snapshots: inheritContentSnapshots(data.snapshots),
                status: "verified",
              }),
              rendererJson: testRendererJson(),
            })
          ).resolves.toBeDefined();
          await expect(
            readRelease(t, BOOTSTRAP.releaseId)
          ).resolves.toMatchObject({ bootstrap: true });
        });
      })
  );

  it.live("requires the try-out snapshot, not the others, to be replaced", () =>
    Effect.gen(function* () {
      const state = {
        activeContentGeneration: RETIRED_CONTENT_GENERATION,
        activeReleaseId: RETIRED_BASE.releaseId,
      } as const;
      const replaced = replacedSnapshots();
      const kept = inheritContentSnapshot(TEST_DIGEST);
      const manifestOf = (snapshots: ContentSnapshotSet) =>
        decodeReleaseJson(bootstrapJson({ snapshots })).pipe(
          Effect.map((signed) => signed.manifest)
        );
      expect(
        isBootstrapCandidate(
          yield* manifestOf({ ...replaced, program: kept, quran: kept }),
          state
        )
      ).toBe(true);
      expect(
        isBootstrapCandidate(
          yield* manifestOf({ ...replaced, tryout: kept }),
          state
        )
      ).toBe(false);
    })
  );

  /** Refuses one recovery staged over a candidate whose active release has the given generation. */
  async function expectRecoveryRefused(
    generation: typeof contentGenerationValidator.Type | null,
    message: string
  ) {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      seedRetiredCandidate(ctx, { bootstrap: false, generation })
    );

    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining(message),
      },
    });
    await expect(
      readRelease(t, BOOTSTRAP_RECOVERY.releaseId)
    ).resolves.toBeNull();
  }

  it("refuses a recovery over a retired generation", () =>
    expectRecoveryRefused(
      RETIRED_CONTENT_GENERATION,
      "retired content generation"
    ));

  it("refuses a recovery over an unrecorded generation", () =>
    expectRecoveryRefused(null, "is not recorded"));

  it("stages the recovery of a candidate over the current generation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      seedRetiredCandidate(ctx, {
        bootstrap: false,
        generation: CURRENT_CONTENT_GENERATION,
      })
    );

    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).resolves.toMatchObject({
      phase: "staging",
      releaseId: BOOTSTRAP_RECOVERY.releaseId,
    });
  });
});
