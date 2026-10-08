import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { advancePublication } from "@repo/backend/confect/contentRelease/ingress/lifecycle";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import { convexModules } from "@repo/backend/confect/test.setup";
import { workflow } from "@repo/backend/confect/workflow";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  insertActivationPair,
  makeActivationPair,
} from "@repo/backend/test/content/activation";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import {
  completeContentProof,
  prepareContentProof,
  recomputeContentProof,
} from "@repo/backend/test/content/verify";
import { convexTest, type TestConvex } from "convex-test";
import { Data, Effect, Schema } from "effect";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return {
    contentKeyResolver: TEST_KEY_RESOLVER,
  };
});
const releaseId = ReleaseIdSchema.make("release-lifecycle-ingress");
const release = testSignedRelease(testEmptyManifest(releaseId));
const recoveryReleaseId = ReleaseIdSchema.make(
  "release-lifecycle-ingress-recovery"
);
class ObservedLifecycleActionFailure extends Schema.TaggedError<ObservedLifecycleActionFailure>()(
  "ObservedLifecycleActionFailure",
  {
    cause: Schema.Unknown,
  }
) {}
class UnexpectedLifecycleTestState extends Data.TaggedError(
  "UnexpectedLifecycleTestState"
)<{
  readonly operation: "mark-proof-failed";
}> {}

/** Inserts one verified release with explicit frozen renderer bytes. */
const insertRelease = Effect.fn("test.contentRelease.insertLifecycleRelease")(
  function* (ctx: MutationCtx, rendererJson: string) {
    const now = Date.UTC(2026, 6, 22, 12, 0, 0);
    yield* Effect.promise(() =>
      ctx.db.insert("contentReleases", {
        ...releaseReachability(release),
        baseFamilies: [],
        checkedIndex: -1,
        checkedItems: 0,
        createdAt: now,
        proofAt: now,
        proofJson: "{}",
        releaseId,
        releaseJson: encodeReleaseJson(release),
        rendererJson,
        resultFamilies: [...release.manifest.scope.families],
        role: "candidate",
        sequence: 1,
        stagedArtifacts: 0,
        stagedDeletes: 0,
        stagedItems: 0,
        stagedProjections: 0,
        stagedRoutes: 0,
        stagedSnapshotBatches: 0,
        stagedSnapshotRows: 0,
        stagedUpserts: 0,
        status: "verified",
        updatedAt: now,
        verifiedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.insert("contentState", {
        articleSlot: "blue",
        candidateManifestHash: release.manifestHash,
        candidateReleaseId: releaseId,
        candidateSequence: 1,
        key: "primary",
        materialSlot: "blue",
        nextSequence: 2,
        searchSlot: "blue",
        updatedAt: now,
      })
    );
  }
);

/** Marks one stored proof as terminally failed for ingress observation. */
const markProofFailed = Effect.fn("test.contentRelease.markProofFailed")(
  function* (ctx: MutationCtx) {
    const stored = yield* Effect.promise(() =>
      ctx.db.query("contentReleases").unique()
    );
    if (!stored) {
      return yield* Effect.die(
        new UnexpectedLifecycleTestState({
          operation: "mark-proof-failed",
        })
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", stored._id, {
        proofFailure: "failed",
        status: "verifying",
      })
    );
  }
);

/** Runs one lifecycle program through the explicit technical verification key. */
const runLifecycle = Effect.fn("test.contentRelease.runLifecycle")(function* <
  A,
  E,
>(
  target: TestConvex<typeof schema>,
  makeProgram: (
    ctx: ActionCtx
  ) => Effect.Effect<
    A,
    E,
    | ContentVerificationKeyResolver
    | RegisteredFunction.ActionServices<typeof confectSchema>
  >
) {
  const runtimeServices = yield* Effect.context<never>();
  return yield* Effect.tryPromise({
    catch: (cause) =>
      new ObservedLifecycleActionFailure({
        cause,
      }),
    try: () =>
      target.action((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          makeProgram(ctx).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            ),
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        )
      ),
  });
});
describe("content release lifecycle ingress", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.effect(
    "returns in-progress verification without claiming terminal proof",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertSignedCandidate(
              ctx,
              releaseId,
              release,
              encodeRendererJson(TEST_PROOF_RENDERER)
            )
          )
        );
        yield* Effect.promise(() => prepareContentProof(t, releaseId));
        vi.spyOn(workflow, "status").mockResolvedValue({
          type: "inProgress",
          running: [],
        });
        const result = yield* runLifecycle(t, (ctx) => {
          const runMutation = vi.spyOn(ctx, "runMutation");
          return advancePublication({
            operation: "verify",
            release,
          }).pipe(
            Effect.map((response) => {
              expect(runMutation).not.toHaveBeenCalled();
              return response;
            })
          );
        });
        expect(result).toEqual({
          ok: true,
          operation: "verify",
          value: {
            manifestHash: release.manifestHash,
            phase: "verifying",
            releaseId,
          },
        });
      })
  );
  it.effect(
    "returns authenticated evidence after durable proof completion",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertSignedCandidate(
              ctx,
              releaseId,
              release,
              encodeRendererJson(TEST_PROOF_RENDERER)
            )
          )
        );
        yield* Effect.promise(() =>
          completeContentProof(t, release.manifestHash, releaseId)
        );
        const response = yield* runLifecycle(t, (_ctx) =>
          advancePublication({
            operation: "verify",
            release,
          })
        );
        expect(response).toMatchObject({
          ok: true,
          operation: "verify",
          value: {
            evidence: {
              manifestHash: release.manifestHash,
              releaseId,
            },
            phase: "verified",
          },
        });
      })
  );
  it.effect("runs the poll mutation once after the workflow has finished", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            releaseId,
            release,
            encodeRendererJson(TEST_PROOF_RENDERER)
          )
        )
      );
      yield* Effect.promise(() =>
        recomputeContentProof(t, release.manifestHash, releaseId)
      );
      vi.spyOn(workflow, "status").mockResolvedValue({
        result: null,
        type: "completed",
      });
      vi.spyOn(workflow, "cleanup").mockResolvedValue(true);
      const response = yield* runLifecycle(t, (ctx) => {
        const runMutation = vi.spyOn(ctx, "runMutation");
        return advancePublication({
          operation: "verify",
          release,
        }).pipe(
          Effect.map((value) => {
            expect(runMutation).toHaveBeenCalledTimes(1);
            return value;
          })
        );
      });
      expect(response).toMatchObject({
        ok: true,
        operation: "verify",
        value: {
          evidence: {
            manifestHash: release.manifestHash,
            releaseId,
          },
          phase: "verified",
        },
      });
    })
  );
  it.effect("surfaces only the stable terminal proof category", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            releaseId,
            release,
            encodeRendererJson(TEST_PROOF_RENDERER)
          )
        )
      );
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            markProofFailed(ctx).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const failure = yield* runLifecycle(t, (_ctx) =>
        advancePublication({
          operation: "verify",
          release,
        })
      ).pipe(Effect.flip);
      expect(getUnknownErrorMessage(failure.cause)).toContain(
        `Content release ${releaseId} proof workflow failed.`
      );
    })
  );
  it.effect(
    "aborts through the server-owned cursor and returns exact evidence",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(ctx, encodeRendererJson(TEST_PROOF_RENDERER)).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const response = yield* runLifecycle(t, (_ctx) =>
          advancePublication({
            operation: "abort",
            releaseId,
          })
        );
        expect(response).toEqual({
          ok: true,
          operation: "abort",
          value: {
            complete: true,
            processedItems: 0,
            releaseId,
            totalItems: 0,
          },
        });
      })
  );
  it.effect(
    "rejects activation when the frozen renderer identity drifted",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRelease(
                ctx,
                encodeRendererJson(testProofRenderer("h1"))
              ).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const failure = yield* runLifecycle(t, (_ctx) =>
          advancePublication({
            operation: "activate",
            release,
          })
        ).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "Lifecycle renderer does not match the signed release"
        );
      })
  );
  it.effect("rejects a tampered release before any lifecycle read", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const prefix = release.signature.startsWith("A") ? "B" : "A";
      const tampered = {
        ...release,
        signature: Ed25519SignatureSchema.make(
          `${prefix}${release.signature.slice(1)}`
        ),
      };
      const failure = yield* runLifecycle(t, (_ctx) =>
        advancePublication({
          operation: "verify",
          release: tampered,
        })
      ).pipe(Effect.flip);
      expect(getUnknownErrorMessage(failure.cause)).toContain(
        "Content release verification failed"
      );
    })
  );
  it.effect("keeps the external activation receipt unchanged", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const pair = makeActivationPair();
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            insertActivationPair(ctx, pair.candidate, pair.recovery).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const activated = yield* runLifecycle(t, (_ctx) =>
        advancePublication({
          operation: "activate",
          release: pair.candidate,
        })
      );
      const repeated = yield* runLifecycle(t, (_ctx) =>
        advancePublication({
          operation: "activate",
          release: pair.candidate,
        })
      );
      expect(activated).toEqual(repeated);
      expect(activated).toMatchObject({
        ok: true,
        operation: "activate",
        value: {
          manifestHash: pair.candidate.manifestHash,
          releaseId,
        },
      });
      expect(activated.value).not.toHaveProperty("kind");
      expect(
        yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
        )
      ).toEqual([]);
      const recovered = yield* runLifecycle(t, (_ctx) =>
        advancePublication({
          operation: "activateRecovery",
          release: pair.recovery,
        })
      );
      expect(recovered).toMatchObject({
        ok: true,
        operation: "activateRecovery",
        value: {
          manifestHash: pair.recovery.manifestHash,
          releaseId: recoveryReleaseId,
        },
      });
      expect(recovered.value).not.toHaveProperty("kind");
      const repeatedRecovery = yield* runLifecycle(t, (_ctx) =>
        advancePublication({
          operation: "activateRecovery",
          release: pair.recovery,
        })
      );
      expect(repeatedRecovery).toEqual(recovered);
      expect(
        yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
        )
      ).toEqual([]);
    })
  );
});
