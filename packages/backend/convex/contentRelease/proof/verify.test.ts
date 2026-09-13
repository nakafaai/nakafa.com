// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  recomputeProgram,
  verifyArtifactBatchProgram,
} from "@repo/backend/convex/contentRelease/proof/verify";
import { encodeArtifactJson } from "@repo/backend/convex/contentRelease/wire";
import {
  getUnknownErrorMessage,
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { insertDeleteRelease } from "@repo/backend/test/content/recompute";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import {
  prepareContentProof,
  recomputeContentProof,
  stageUpsertFixture,
} from "@repo/backend/test/content/verify";
import { getFunctionName } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";
import { Data, Effect, Schema } from "effect";

const releaseId = ReleaseIdSchema.make("release-proof");
const manifest = testEmptyManifest(releaseId);
const signedRelease = testSignedRelease(manifest);
const manifestHash = signedRelease.manifestHash;

class ObservedProofFailure extends Schema.TaggedError<ObservedProofFailure>()(
  "ObservedProofFailure",
  { cause: Schema.Unknown }
) {}

class UnexpectedProofTestState extends Data.TaggedError(
  "UnexpectedProofTestState"
)<{
  readonly operation:
    | "load-candidate-manifest"
    | "load-proof-release"
    | "load-staged-artifact";
}> {}

/** Creates one isolated database for the production proof program. */
function createProofTest() {
  return convexTest(schema, convexModules);
}

/** Observes the production proof across convex-test's component limitation. */
const runProof = Effect.fn("contentRelease.proof.verify.test.runProof")(
  function* (
    t: TestConvex<typeof schema>,
    options: {
      readonly hash?: string;
      readonly releaseId?: string;
      readonly resolver?: typeof TEST_KEY_RESOLVER;
    } = {}
  ) {
    const hash = options.hash ?? manifestHash;
    const proofReleaseId = options.releaseId ?? releaseId;
    const resolver = options.resolver ?? TEST_KEY_RESOLVER;
    return yield* Effect.tryPromise({
      catch: (cause) => new ObservedProofFailure({ cause }),
      try: () => recomputeContentProof(t, hash, proofReleaseId, resolver),
    });
  }
);

/** Inserts one authenticated candidate using the canonical technical fixture. */
const insertRelease = Effect.fn(
  "contentRelease.proof.verify.test.insertRelease"
)((ctx: MutationCtx) =>
  Effect.promise(() =>
    insertSignedCandidate(
      ctx,
      releaseId,
      signedRelease,
      JSON.stringify(TEST_PROOF_RENDERER)
    )
  )
);

/** Changes only the stored signature while preserving its claimed identity. */
const tamperArtifactSignature = Effect.fn(
  "contentRelease.proof.verify.test.tamperArtifactSignature"
)(function* (artifactJson: string) {
  const artifact = yield* Schema.decodeEffect(
    Schema.fromJsonString(SignedContentArtifactSchema)
  )(artifactJson);
  const firstCharacter = artifact.signature.startsWith("A") ? "B" : "A";
  const signature = Ed25519SignatureSchema.make(
    `${firstCharacter}${artifact.signature.slice(1)}`
  );
  return encodeArtifactJson({ ...artifact, signature });
});

/** Loads one staged proof release or defects on an invalid fixture. */
const loadProofRelease = Effect.fn(
  "contentRelease.proof.verify.test.loadProofRelease"
)(function* (ctx: MutationCtx) {
  const release = yield* Effect.promise(() =>
    ctx.db.query("contentReleases").unique()
  );
  if (!release) {
    return yield* Effect.die(
      new UnexpectedProofTestState({ operation: "load-proof-release" })
    );
  }
  return release;
});

/** Corrupts the frozen renderer while preserving the release identity. */
const driftStoredRenderer = Effect.fn(
  "contentRelease.proof.verify.test.driftStoredRenderer"
)(function* (ctx: MutationCtx) {
  const release = yield* loadProofRelease(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      rendererJson: JSON.stringify(testProofRenderer("h1")),
    })
  );
});

/** Corrupts durable counters after the release entered verification. */
const driftDurableCounters = Effect.fn(
  "contentRelease.proof.verify.test.driftDurableCounters"
)(function* (ctx: MutationCtx) {
  const release = yield* loadProofRelease(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedItems: 1,
      status: "verifying",
    })
  );
});

/** Corrupts one staged artifact signature inside the real test transaction. */
const tamperStoredArtifact = Effect.fn(
  "contentRelease.proof.verify.test.tamperStoredArtifact"
)(function* (ctx: MutationCtx) {
  const artifact = yield* Effect.promise(() =>
    ctx.db.query("contentArtifacts").unique()
  );
  if (!artifact) {
    return yield* Effect.die(
      new UnexpectedProofTestState({ operation: "load-staged-artifact" })
    );
  }
  const artifactJson = yield* tamperArtifactSignature(
    artifact.artifactJson
  ).pipe(Effect.orDie);
  yield* Effect.promise(() =>
    ctx.db.patch("contentArtifacts", artifact._id, { artifactJson })
  );
});

describe("contentRelease/proof/verify", () => {
  it("checks the renderer binding inside each independent artifact worker", async () => {
    const t = createProofTest();
    await t.mutation((ctx) => runConvexProgram(insertRelease(ctx)));
    await prepareContentProof(t, releaseId);
    await t.mutation((ctx) => runConvexProgram(driftStoredRenderer(ctx)));
    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyArtifactBatchProgram(ctx, manifestHash, releaseId, 0).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_UNSUPPORTED" } });
  });

  it.each([null, "stalled-cursor"])(
    "rejects non-advancing route catalog evidence at %s",
    async (cursor) => {
      const t = createProofTest();
      await t.mutation((ctx) => runConvexProgram(insertRelease(ctx)));
      await prepareContentProof(t, releaseId);
      await expect(
        t.action((ctx) => {
          const runQuery = ctx.runQuery;
          vi.spyOn(ctx, "runQuery").mockImplementation((...callArgs) => {
            const [reference, args] = callArgs;
            if (
              getFunctionName(reference) ===
              "contentRelease/proof/routes:routes"
            ) {
              return Promise.resolve({
                checked: 1,
                done: false,
                nextCursor: cursor,
              });
            }
            return runQuery(reference, args);
          });
          return runConvexProgram(
            recomputeProgram(ctx, manifestHash, releaseId, 0).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              )
            )
          );
        })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("stopped advancing"),
        },
      });
    }
  );

  it("rejects artifact-worker totals that disagree with the authenticated streams", async () => {
    const t = createProofTest();
    await t.mutation((ctx) => runConvexProgram(insertRelease(ctx)));
    await prepareContentProof(t, releaseId);
    await expect(
      t.action((ctx) =>
        runConvexProgram(
          recomputeProgram(ctx, manifestHash, releaseId, 1).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("counters do not match"),
      },
    });
  });

  it("authenticates registered worker actions at their actual production boundary", async () => {
    const t = createProofTest();
    await expect(
      t.action(internal.contentRelease.proof.verify.verifyArtifacts, {
        batchIndex: 0,
        manifestHash,
        releaseId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
    await expect(
      t.action(internal.contentRelease.proof.verify.verifyRelease, {
        manifestHash,
        releaseId,
        verifiedArtifacts: 0,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it.effect(
    "recomputes an authenticated empty proof and commits it exactly once",
    Effect.fn("contentRelease.proof.verify.test.recomputesEmptyProof")(
      function* () {
        const t = createProofTest();
        yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );

        const proof = yield* runProof(t);
        const release = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentReleases").unique())
        );

        expect(proof).toMatchObject({
          itemCount: 0,
          manifestHash,
          releaseId,
          stagedArtifacts: 0,
        });
        expect(release).toMatchObject({
          checkedItems: 0,
          proofJson: JSON.stringify(proof),
          status: "verifying",
        });
      }
    )
  );

  it.effect(
    "fails closed when no production key has been reviewed",
    Effect.fn("contentRelease.proof.verify.test.rejectsMissingKey")(
      function* () {
        const t = createProofTest();
        yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );

        const failure = yield* runProof(t, {
          resolver: contentKeyResolver,
        }).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "Content release verification failed with SigningKeyNotFoundError."
        );
      }
    )
  );

  it.effect(
    "recovers stable internal failures into the typed channel",
    Effect.fn("contentRelease.proof.verify.test.recoversTypedFailure")(
      function* () {
        const t = createProofTest();

        const result = yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexActionProgram(
              recomputeProgram(ctx, manifestHash, releaseId, 0).pipe(
                Effect.match({
                  onFailure: (error) => ({
                    code: error.code,
                    tag: error._tag,
                  }),
                  onSuccess: () => ({ code: null, tag: null }),
                }),
                Effect.provideService(
                  ContentVerificationKeyResolver,
                  TEST_KEY_RESOLVER
                )
              )
            )
          )
        );

        expect(result).toEqual({
          code: "CONTENT_RELEASE_MISSING",
          tag: "ReleaseError",
        });
      }
    )
  );

  it.effect(
    "replays multi-page item and proof streams before committing",
    Effect.fn("contentRelease.proof.verify.test.replaysPagedProof")(
      function* () {
        const t = createProofTest();
        const hash = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertDeleteRelease(ctx, 129, releaseId))
          )
        );

        const proof = yield* runProof(t, { hash });
        expect(proof).toMatchObject({
          deleteHeads: 129,
          itemCount: 129,
          stagedArtifacts: 0,
          upsertHeads: 0,
        });
      }
    )
  );

  it.effect(
    "rejects renderer and durable counter drift",
    Effect.fn("contentRelease.proof.verify.test.rejectsDurableDrift")(
      function* () {
        const rendererDrift = createProofTest();
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) =>
            runConvexProgram(driftStoredRenderer(ctx))
          )
        );
        const rendererFailure = yield* runProof(rendererDrift).pipe(
          Effect.flip
        );
        expect(getUnknownErrorMessage(rendererFailure.cause)).toContain(
          "no longer matches its frozen renderer"
        );

        const counters = createProofTest();
        yield* Effect.promise(() =>
          counters.mutation((ctx) => runConvexProgram(insertRelease(ctx)))
        );
        yield* Effect.promise(() =>
          counters.mutation((ctx) =>
            runConvexProgram(driftDurableCounters(ctx))
          )
        );
        const counterFailure = yield* runProof(counters).pipe(Effect.flip);
        expect(getUnknownErrorMessage(counterFailure.cause)).toContain(
          "lost durable progress"
        );
      }
    )
  );

  it.effect(
    "reauthenticates stored artifacts before committing proof",
    Effect.fn("contentRelease.proof.verify.test.reauthenticatesArtifacts")(
      function* () {
        const t = createProofTest();
        yield* Effect.promise(() => stageUpsertFixture(t));
        const state = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentState").unique())
        );
        if (!state?.candidateManifestHash) {
          return yield* Effect.die(
            new UnexpectedProofTestState({
              operation: "load-candidate-manifest",
            })
          );
        }
        yield* Effect.promise(() =>
          t.mutation((ctx) => runConvexProgram(tamperStoredArtifact(ctx)))
        );

        const failure = yield* runProof(t, {
          hash: state.candidateManifestHash,
          releaseId: TEST_RELEASE_ID,
        }).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "Content release verification failed"
        );
        const release = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentReleases").unique())
        );
        expect(release?.proofJson).toBeUndefined();
      }
    )
  );
});
