import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { actionLayer } from "@confect/server/RegisteredFunction";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import {
  driftDurableCounters,
  driftStoredRenderer,
  tamperStoredArtifact,
} from "@repo/backend/test/content/drift";
// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ReleaseVerificationEvidenceSchema } from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  recomputeProgram,
  verifyArtifactBatchProgram,
} from "@repo/backend/confect/contentRelease/proof/verify";
import { convexModules } from "@repo/backend/confect/test.setup";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { stagePagedRelease } from "@repo/backend/test/content/recompute";
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
const rendererJson = Schema.encodeSync(
  Schema.fromJsonString(RendererManifestEnvelopeSchema)
)(TEST_PROOF_RENDERER);
class ObservedProofFailure extends Schema.TaggedError<ObservedProofFailure>()(
  "ObservedProofFailure",
  {
    cause: Schema.Unknown,
  }
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
      catch: (cause) =>
        new ObservedProofFailure({
          cause,
        }),
      try: () => recomputeContentProof(t, hash, proofReleaseId, resolver),
    });
  }
);

/** Inserts one authenticated candidate using the canonical technical fixture. */
const insertRelease = Effect.fn(
  "contentRelease.proof.verify.test.insertRelease"
)((ctx: MutationCtx) =>
  Effect.promise(() =>
    insertSignedCandidate(ctx, releaseId, signedRelease, rendererJson)
  )
);

describe("contentRelease/proof/verify", () => {
  it("checks the renderer binding inside each independent artifact worker", async () => {
    const t = createProofTest();
    await t.mutation((ctx) =>
      Effect.runPromise(
        insertRelease(ctx).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    await prepareContentProof(t, releaseId);
    await t.mutation((ctx) =>
      Effect.runPromise(
        driftStoredRenderer(ctx).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          verifyArtifactBatchProgram(manifestHash, releaseId, 0).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            ),
            Effect.provide(actionLayer(confectSchema, ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_UNSUPPORTED",
    });
  });
  it.each([
    {
      source: "routes",
      cursor: null,
    },
    {
      source: "routes",
      cursor: "stalled-cursor",
    },
    {
      source: "catalog",
      cursor: null,
    },
    {
      source: "catalog",
      cursor: {
        artifactLocale: "en",
        contentKey: "stalled",
      },
    },
  ])(
    "rejects non-advancing $source evidence at $cursor",
    async ({ source, cursor }) => {
      const t = createProofTest();
      await t.mutation((ctx) =>
        Effect.runPromise(
          insertRelease(ctx).pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        )
      );
      await prepareContentProof(t, releaseId);
      await expect(
        t.action((ctx) => {
          const runQuery = ctx.runQuery;
          vi.spyOn(ctx, "runQuery").mockImplementation((...callArgs) => {
            const [reference, args] = callArgs;
            if (
              getFunctionName(reference) ===
              `contentRelease/proof/${source}:${source === "routes" ? "routes" : "page"}`
            ) {
              return Promise.resolve({
                ...(source === "routes"
                  ? {
                      checked: 1,
                    }
                  : {
                      heads: [],
                    }),
                done: false,
                nextCursor: cursor,
              });
            }
            return runQuery(reference, args);
          });
          return Effect.runPromise(
            recomputeProgram(manifestHash, releaseId, 0).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              ),
              Effect.provide(actionLayer(confectSchema, ctx))
            )
          );
        })
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("stopped advancing"),
      });
    }
  );
  it("rejects artifact-worker totals that disagree with the authenticated streams", async () => {
    const t = createProofTest();
    await t.mutation((ctx) =>
      Effect.runPromise(
        insertRelease(ctx).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    await prepareContentProof(t, releaseId);
    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          recomputeProgram(manifestHash, releaseId, 1).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            ),
            Effect.provide(actionLayer(confectSchema, ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: expect.stringContaining("counters do not match"),
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
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_MISSING",
      },
    });
    await expect(
      t.action(internal.contentRelease.proof.verify.verifyRelease, {
        manifestHash,
        releaseId,
        verifiedArtifacts: 0,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_MISSING",
      },
    });
  });
  it.effect(
    "recomputes an authenticated empty proof and commits it exactly once",
    Effect.fn("contentRelease.proof.verify.test.recomputesEmptyProof")(
      function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createProofTest();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
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
        const proofJson = yield* Schema.encodeEffect(
          Schema.fromJsonString(ReleaseVerificationEvidenceSchema)
        )(proof);
        expect(release).toMatchObject({
          checkedItems: 0,
          proofJson,
          status: "verifying",
        });
      }
    )
  );
  it.effect(
    "fails closed when no production key has been reviewed",
    Effect.fn("contentRelease.proof.verify.test.rejectsMissingKey")(
      function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createProofTest();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
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
        const runtimeServices = yield* Effect.context<never>();
        const t = createProofTest();
        const result = yield* Effect.promise(() =>
          t.action((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              recomputeProgram(manifestHash, releaseId, 0).pipe(
                Effect.match({
                  onFailure: (error) => ({
                    code: error.code,
                    tag: error._tag,
                  }),
                  onSuccess: () => ({
                    code: null,
                    tag: null,
                  }),
                }),
                Effect.provideService(
                  ContentVerificationKeyResolver,
                  TEST_KEY_RESOLVER
                ),
                Effect.provide(actionLayer(confectSchema, ctx))
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
        const runtimeServices = yield* Effect.context<never>();
        const t = createProofTest();
        const hash = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stagePagedRelease(129, releaseId).pipe(
                Effect.orDie,
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        const proof = yield* runProof(t, {
          hash,
        });
        expect(proof).toMatchObject({
          deleteHeads: 0,
          itemCount: 129,
          stagedArtifacts: 129,
          upsertHeads: 129,
        });
      }
    )
  );
  it.effect(
    "rejects renderer and durable counter drift",
    Effect.fn("contentRelease.proof.verify.test.rejectsDurableDrift")(
      function* () {
        const runtimeServices = yield* Effect.context<never>();
        const rendererDrift = createProofTest();
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              driftStoredRenderer(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
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
          counters.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        yield* Effect.promise(() =>
          counters.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              driftDurableCounters(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
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
        const runtimeServices = yield* Effect.context<never>();
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
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              tamperStoredArtifact(ctx).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
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
