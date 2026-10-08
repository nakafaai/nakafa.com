import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
// @vitest-environment node

import { Buffer } from "node:buffer";
import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ProgramSnapshotSchema } from "@nakafa/aksara-contracts/program/snapshot/spec";
import {
  ContentReleaseManifestSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { canonicalizeContentReleaseSigningInput } from "@nakafa/aksara-contracts/release/signing";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { stagePublication } from "@repo/backend/confect/contentRelease/ingress/stage";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { convexModules } from "@repo/backend/confect/test.setup";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  ingressArtifact,
  ingressItem,
  ingressRelease,
  ingressReleaseId,
} from "@repo/backend/test/content/ingress";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  TEST_PUBLIC_KEY,
  testEmptyManifest,
  testProofRenderer,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import {
  makeProgramSnapshotData,
  type ProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Data, Effect, Schema } from "effect";

const encodeRendererJson = Schema.encodeSync(
  Schema.fromJsonString(RendererManifestEnvelopeSchema)
);
const candidateId = ReleaseIdSchema.make("release-stage-candidate");
const activeKeyId = SigningKeyIdSchema.make("test-active-key");
const activeKeys = generateKeyPairSync("ed25519");
const activePublicKey = activeKeys.publicKey
  .export({
    format: "pem",
    type: "spki",
  })
  .toString();
const rotatedKeyResolver = ContentVerificationKeyResolver.of({
  resolve: (keyId) => {
    if (keyId === activeKeyId) {
      return Effect.succeed(activePublicKey);
    }
    if (keyId === TEST_KEY_ID) {
      return Effect.succeed(TEST_PUBLIC_KEY);
    }
    return TEST_KEY_RESOLVER.resolve(keyId);
  },
});

/** Re-signs the complete ingress manifest under the simulated active key. */
function activeSignedRelease() {
  return SignedContentReleaseSchema.make({
    keyId: activeKeyId,
    manifest: ingressRelease.manifest,
    manifestHash: ingressRelease.manifestHash,
    signature: Ed25519SignatureSchema.make(
      signBytes(
        null,
        Buffer.from(
          canonicalizeContentReleaseSigningInput(
            ingressRelease.manifestHash,
            ingressRelease.manifest
          ),
          "utf8"
        ),
        activeKeys.privateKey
      ).toString("base64url")
    ),
  });
}

/** Creates one signed empty release bound to the technical renderer. */
function signedRelease(releaseId = candidateId) {
  return testSignedRelease(testEmptyManifest(releaseId));
}

/** Signs one candidate that replaces the complete technical program snapshot. */
function snapshotRelease(snapshots: ProgramSnapshotData["snapshots"]) {
  return testSignedRelease(
    ContentReleaseManifestSchema.make({
      ...testEmptyManifest(candidateId),
      scope: testPublicationScope({
        snapshots,
      }),
      snapshots,
    })
  );
}
class ObservedStageActionFailure extends Schema.TaggedError<ObservedStageActionFailure>()(
  "ObservedStageActionFailure",
  {
    cause: Schema.Unknown,
  }
) {}
class UnexpectedStageTestState extends Data.TaggedError(
  "UnexpectedStageTestState"
)<{
  readonly operation: "select-program-row" | "select-recovery-release";
}> {}

/** Stores one candidate or recovery release under the rotated-key fixture. */
const storeIngressRelease = Effect.fn(
  "test.contentRelease.storeIngressRelease"
)(function* (ctx: MutationCtx, role: "candidate" | "recovery") {
  yield* Effect.promise(() =>
    insertSignedCandidate(
      ctx,
      ingressReleaseId,
      activeSignedRelease(),
      encodeRendererJson(TEST_PROOF_RENDERER)
    )
  );
  if (role === "candidate") {
    return;
  }
  const [release, state] = yield* Effect.all([
    Effect.promise(() => ctx.db.query("contentReleases").unique()),
    Effect.promise(() => ctx.db.query("contentState").unique()),
  ]);
  if (!(release && state)) {
    return yield* Effect.die(
      new UnexpectedStageTestState({
        operation: "select-recovery-release",
      })
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      role,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.patch("contentState", state._id, {
      candidateManifestHash: undefined,
      candidateReleaseId: undefined,
      candidateSequence: undefined,
      recoveryManifestHash: ingressRelease.manifestHash,
      recoveryReleaseId: ingressReleaseId,
      recoverySequence: release.sequence,
    })
  );
});

/** Runs one staging program through the real Convex action boundary. */
const runStage = Effect.fn("test.contentRelease.runStage")(function* <A, E>(
  target: TestConvex<typeof schema>,
  makeProgram: (
    ctx: ActionCtx
  ) => Effect.Effect<
    A,
    E,
    | ContentVerificationKeyResolver
    | RegisteredFunction.ActionServices<typeof confectSchema>
  >,
  resolver = TEST_KEY_RESOLVER
) {
  const runtimeServices = yield* Effect.context<never>();
  return yield* Effect.tryPromise({
    catch: (cause) =>
      new ObservedStageActionFailure({
        cause,
      }),
    try: () =>
      target.action((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          makeProgram(ctx).pipe(
            Effect.provideService(ContentVerificationKeyResolver, resolver),
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        )
      ),
  });
});
describe("content release staging ingress", () => {
  it.effect("rejects a renderer not owned by the signed release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const failure = yield* runStage(t, (_ctx) =>
        stagePublication(
          {
            operation: "stageRelease",
            release: signedRelease(),
            rendererManifest: testProofRenderer("h1"),
          },
          TEST_KEY_ID
        )
      ).pipe(Effect.flip);
      expect(getUnknownErrorMessage(failure.cause)).toContain(
        "does not own the supplied renderer snapshot"
      );
    })
  );
  it.effect("rejects a stored candidate whose signed identity drifted", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const other = signedRelease(ReleaseIdSchema.make("release-stage-other"));
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            candidateId,
            other,
            encodeRendererJson(TEST_PROOF_RENDERER)
          )
        )
      );
      const failure = yield* runStage(t, (_ctx) =>
        stagePublication(
          {
            artifacts: [testSignedArtifact()],
            batchIndex: 0,
            operation: "stageArtifactBatch",
            releaseId: candidateId,
          },
          TEST_KEY_ID
        )
      ).pipe(Effect.flip);
      expect(getUnknownErrorMessage(failure.cause)).toContain(
        "identity does not match its stored envelope"
      );
    })
  );
  it.effect("rejects a tampered artifact before storage", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            candidateId,
            signedRelease(),
            encodeRendererJson(TEST_PROOF_RENDERER)
          )
        )
      );
      const artifact = testSignedArtifact();
      const prefix = artifact.signature.startsWith("A") ? "B" : "A";
      const tampered = {
        ...artifact,
        signature: Ed25519SignatureSchema.make(
          `${prefix}${artifact.signature.slice(1)}`
        ),
      };
      const failure = yield* runStage(t, (_ctx) =>
        stagePublication(
          {
            artifacts: [tampered],
            batchIndex: 0,
            operation: "stageArtifactBatch",
            releaseId: candidateId,
          },
          TEST_KEY_ID
        )
      ).pipe(Effect.flip);
      expect(getUnknownErrorMessage(failure.cause)).toContain(
        "Content release verification failed"
      );
    })
  );
  it.effect(
    "admits retained artifacts only for authenticated recovery rows",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        for (const role of ["candidate", "recovery"] as const) {
          const t = convexTest(schema, convexModules);
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                storeIngressRelease(ctx, role).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          );
          yield* runStage(
            t,
            (_ctx) =>
              stagePublication({
                batchIndex: 0,
                items: [ingressItem],
                operation: "stageItemBatch",
                releaseId: ingressReleaseId,
              }),
            rotatedKeyResolver
          );
          const stageArtifact = runStage(
            t,
            (_ctx) =>
              stagePublication(
                {
                  artifacts: [ingressArtifact],
                  batchIndex: 0,
                  operation: "stageArtifactBatch",
                  releaseId: ingressReleaseId,
                },
                activeKeyId
              ),
            rotatedKeyResolver
          );
          if (role === "candidate") {
            const failure = yield* stageArtifact.pipe(Effect.flip);
            expect(getUnknownErrorMessage(failure.cause)).toContain(
              "must use the active content signing key"
            );
            continue;
          }
          expect(yield* stageArtifact).toMatchObject({
            ok: true,
            operation: "stageArtifactBatch",
            value: {
              created: 1,
              unchanged: 0,
            },
          });
        }
      })
  );
  it.effect(
    "rejects a poisoned manifest before storage and accepts its exact retry",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const release = snapshotRelease(data.snapshots);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertSignedCandidate(
              ctx,
              candidateId,
              release,
              encodeRendererJson(TEST_PROOF_RENDERER)
            )
          )
        );
        const tampered: ContentSnapshotManifest = {
          family: "program",
          manifest: ProgramSnapshotSchema.make({
            ...data.snapshot.manifest,
            rowDigest: Sha256HashSchema.make(`sha256:${"9".repeat(64)}`),
          }),
        };
        const failure = yield* runStage(t, (_ctx) =>
          stagePublication({
            operation: "stageSnapshot",
            releaseId: candidateId,
            snapshot: tampered,
          })
        ).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "invalid content identity"
        );
        expect(
          yield* Effect.promise(() =>
            t.run((ctx) => ctx.db.query("contentSnapshots").unique())
          )
        ).toBeNull();
        expect(
          yield* runStage(t, (_ctx) =>
            stagePublication({
              operation: "stageSnapshot",
              releaseId: candidateId,
              snapshot: data.snapshot,
            })
          )
        ).toMatchObject({
          ok: true,
          operation: "stageSnapshot",
          value: {
            created: 1,
            snapshotId: data.snapshotId,
          },
        });
      })
  );
  it.effect(
    "rejects poisoned rows before storage and accepts the exact batch retry",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const [firstRow, ...remainingRows] = data.rows;
        if (firstRow?.family !== "program") {
          return yield* Effect.die(
            new UnexpectedStageTestState({
              operation: "select-program-row",
            })
          );
        }
        const tampered: ContentSnapshotRow = {
          ...firstRow,
          record: {
            ...firstRow.record,
            rowHash: Sha256HashSchema.make(`sha256:${"9".repeat(64)}`),
          },
        };
        const release = snapshotRelease(data.snapshots);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertSignedCandidate(
              ctx,
              candidateId,
              release,
              encodeRendererJson(TEST_PROOF_RENDERER)
            )
          )
        );
        yield* runStage(t, (_ctx) =>
          stagePublication({
            operation: "stageSnapshot",
            releaseId: candidateId,
            snapshot: data.snapshot,
          })
        );
        const failure = yield* runStage(t, (_ctx) =>
          stagePublication({
            batchIndex: 0,
            family: "program",
            operation: "stageSnapshotBatch",
            releaseId: candidateId,
            rows: [tampered],
            snapshotId: data.snapshotId,
          })
        ).pipe(Effect.flip);
        expect(getUnknownErrorMessage(failure.cause)).toContain(
          "invalid content identity"
        );
        const stored = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            batches: await ctx.db.query("snapshotBatches").collect(),
            curriculum: await ctx.db.query("curriculumRoutes").collect(),
            programs: await ctx.db.query("programCatalog").collect(),
          }))
        );
        expect(stored).toEqual({
          batches: [],
          curriculum: [],
          programs: [],
        });
        expect(
          yield* runStage(t, (_ctx) =>
            stagePublication({
              batchIndex: 0,
              family: "program",
              operation: "stageSnapshotBatch",
              releaseId: candidateId,
              rows: [firstRow, ...remainingRows],
              snapshotId: data.snapshotId,
            })
          )
        ).toMatchObject({
          ok: true,
          operation: "stageSnapshotBatch",
          value: {
            batchIndex: 0,
            family: "program",
            snapshotId: data.snapshotId,
          },
        });
      })
  );
});
