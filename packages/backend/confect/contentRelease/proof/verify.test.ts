import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { actionLayer } from "@confect/server/RegisteredFunction";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { convexModules } from "@repo/backend/confect/test.setup";
import {
  driftDurableCounters,
  driftStoredRenderer,
  tamperStoredArtifact,
} from "@repo/backend/test/content/drift";
// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseVerificationEvidenceSchema } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  recomputeProgram,
  verifyArtifactBatchProgram,
} from "@repo/backend/confect/contentRelease/proof/verify";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { stagePagedRelease } from "@repo/backend/test/content/recompute";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  insertRelease,
  itWithRelease,
  prepareContentProof,
  proofReleaseId,
  runProof,
  stageUpsertFixture,
  testProofFixture,
  UnexpectedProofTestState,
} from "@repo/backend/test/content/verify";
import { getFunctionName } from "convex/server";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const releaseId = proofReleaseId;

describe("contentRelease/proof/verify", () => {
  itWithRelease(
    "checks the renderer binding inside each independent artifact worker",
    async ({ manifestHash, signedRelease }) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        Effect.runPromise(
          insertRelease(ctx, signedRelease).pipe(
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
    }
  );
  it.effect.each([
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
    ({ source, cursor }) =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { manifestHash, signedRelease } = yield* testProofFixture();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(async () => {
          await t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx, signedRelease).pipe(
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
              return Effect.runPromiseWith(runtimeServices)(
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
        });
      })
  );
  itWithRelease(
    "rejects artifact-worker totals that disagree with the authenticated streams",
    async ({ manifestHash, signedRelease }) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        Effect.runPromise(
          insertRelease(ctx, signedRelease).pipe(
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
    }
  );
  itWithRelease(
    "authenticates registered worker actions at their actual production boundary",
    async ({ manifestHash }) => {
      const t = convexTest(schema, convexModules);
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
    }
  );
  it.effect(
    "recomputes an authenticated empty proof and commits it exactly once",
    Effect.fn("contentRelease.proof.verify.test.recomputesEmptyProof")(
      function* () {
        const { manifestHash, signedRelease } = yield* testProofFixture();
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx, signedRelease).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        const proof = yield* runProof(t, manifestHash);
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
        const { manifestHash, signedRelease } = yield* testProofFixture();
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx, signedRelease).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        const failure = yield* runProof(t, manifestHash, {
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
        const { manifestHash } = yield* testProofFixture();
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
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
        const { manifestHash } = yield* testProofFixture();
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
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
        const proof = yield* runProof(t, manifestHash, {
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
        const { manifestHash, signedRelease } = yield* testProofFixture();
        const runtimeServices = yield* Effect.context<never>();
        const rendererDrift = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          rendererDrift.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx, signedRelease).pipe(
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
        const rendererFailure = yield* runProof(
          rendererDrift,
          manifestHash
        ).pipe(Effect.flip);
        expect(getUnknownErrorMessage(rendererFailure.cause)).toContain(
          "no longer matches its frozen renderer"
        );
        const counters = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          counters.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx, signedRelease).pipe(
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
        const counterFailure = yield* runProof(counters, manifestHash).pipe(
          Effect.flip
        );
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
        const { manifestHash } = yield* testProofFixture();
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
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
        const failure = yield* runProof(t, manifestHash, {
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
