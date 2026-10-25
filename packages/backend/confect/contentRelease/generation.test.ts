import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import {
  CURRENT_CONTENT_GENERATION,
  RETIRED_CONTENT_GENERATION,
  requireCurrentArtifact,
  requireCurrentRelease,
} from "@repo/backend/confect/contentRelease/generation";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

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
      for (const source of [
        "{",
        "[]",
        "{}",
        '{"payload":3}',
        '{"payload":{}}',
        '{"payload":{"format":"content-tree"}}',
        '{"payload":{"format":"other-format"}}',
        '{"payload":{"requiredComponents":"InlineMath"}}',
        '{"payload":{"requiredComponents":[]}}',
        '{"payload":{"requiredComponents":["InlineMath"]}}',
        '{"payload":{"requiredComponents":[null]}}',
        '{"payload":{"requiredComponents":[{"name":"InlineMath"}]}}',
      ]) {
        yield* requireCurrentArtifact(source, IDENTITY, ARTIFACT_HASH);
      }
    })
  );

  it.live(
    "rejects an artifact signed in the retired compiled-body format",
    () =>
      Effect.gen(function* () {
        const retired = yield* requireCurrentArtifact(
          RETIRED_ARTIFACT,
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
        '{"payload":{"requiredComponents":[{"name":"InlineMath","version":1}]}}',
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
    upsertCount: 2,
  });
}

/** Seeds the completed retired base as the active release under the given generation. */
async function seedRetiredBase(
  t: TestConvex<typeof schema>,
  generation:
    | typeof RETIRED_CONTENT_GENERATION
    | typeof CURRENT_CONTENT_GENERATION
    | undefined
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

describe("contentRelease/generation bootstrap at staging", () => {
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

  it.each([
    {
      $description: "a current generation",
      generation: CURRENT_CONTENT_GENERATION,
    },
    { $description: "an unrecorded generation", generation: undefined },
  ])(
    "does not mark a full replacement over $description as a bootstrap",
    async ({ generation }) => {
      const t = convexTest(schema, convexModules);
      await seedRetiredBase(t, generation);

      await t.mutation(stageRelease, {
        releaseJson: bootstrapJson(),
        rendererJson: testRendererJson(),
      });

      const release = await readRelease(t, BOOTSTRAP.releaseId);
      expect(release).toMatchObject({ role: "candidate", status: "staging" });
      expect(release).not.toHaveProperty("bootstrap");
    }
  );

  it("does not mark a partial replacement of the retired generation as a bootstrap", async () => {
    const t = convexTest(schema, convexModules);
    await seedRetiredBase(t, RETIRED_CONTENT_GENERATION);

    await t.mutation(stageRelease, {
      releaseJson: bootstrapJson({ resultCount: 3 }),
      rendererJson: testRendererJson(),
    });

    const release = await readRelease(t, BOOTSTRAP.releaseId);
    expect(release).toMatchObject({ role: "candidate", status: "staging" });
    expect(release).not.toHaveProperty("bootstrap");
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
});
