import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  Ed25519SignatureSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { SignedTryoutRuntimeBundleSchema } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { decodeTryoutRuntimeBundleJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import {
  decodeProtectedRuntimeRow,
  ProtectedRuntimeReadError,
} from "@repo/backend/content/tryout/exchange";
import { readProtectedProgram } from "@repo/backend/content/tryout/protected";
import {
  TEST_KEY_RESOLVER,
  testSignedArtifact,
} from "@repo/backend/test/content/proof";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { Effect, Schema } from "effect";

const otherHash = Sha256HashSchema.make(`sha256:${"9".repeat(64)}`);
const encodeBundleJson = Schema.encodeSync(
  Schema.fromJsonString(SignedTryoutRuntimeBundleSchema)
);
const encodeArtifactJson = Schema.encodeSync(
  Schema.fromJsonString(SignedContentArtifactSchema)
);
describe("protected try-out exchange", () => {
  it.effect(
    "authenticates original question and answer bytes with the requested permanent bundle",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const fixture = yield* Effect.promise(() =>
              insertProtectedRuntime(tCtx)
            );
            expect(
              yield* readProtectedProgram({
                ...fixture.request,
                selectors: [
                  {
                    ...fixture.question,
                    contentKey: fixture.question.contentKey.replace(
                      "/question-1/",
                      "/question-2/"
                    ),
                  },
                ],
              }).pipe(Effect.provide(tryoutLayer), Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("changed its snapshot identity"),
            });
            const row = yield* readProtectedProgram(fixture.request).pipe(
              Effect.provide(tryoutLayer)
            );
            const decoded = yield* decodeProtectedRuntimeRow(
              row,
              fixture.request
            ).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              )
            );
            expect(decoded).toMatchObject({
              kind: "found",
              bundle: {
                bundleHash: fixture.request.bundleHash,
              },
            });
            expect(
              decoded?.items.map(({ artifact }) => artifact.payload.rawMdx)
            ).toEqual(["## Technical question", "#### Technical answer"]);
            expect(
              yield* decodeProtectedRuntimeRow(null, fixture.request).pipe(
                Effect.provideService(
                  ContentVerificationKeyResolver,
                  TEST_KEY_RESOLVER
                )
              )
            ).toBeNull();
          })
        );
      })
  );
  it.effect(
    "rejects malformed bytes, invalid signatures, and a substituted request identity",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const fixture = yield* Effect.promise(() =>
              insertProtectedRuntime(tCtx)
            );
            const row = yield* readProtectedProgram(fixture.request).pipe(
              Effect.provide(tryoutLayer)
            );
            if (row === null) {
              return yield* Effect.die(
                "Expected signed protected source bytes."
              );
            }
            const bundle = yield* decodeTryoutRuntimeBundleJson(row.bundleJson);
            for (const corrupt of [
              {
                ...row,
                rendererJson: "{",
              },
              {
                ...row,
                bundleJson: encodeBundleJson({
                  ...bundle,
                  signature: Ed25519SignatureSchema.make("A".repeat(86)),
                }),
              },
            ]) {
              const error = yield* decodeProtectedRuntimeRow(
                corrupt,
                fixture.request
              ).pipe(
                Effect.provideService(
                  ContentVerificationKeyResolver,
                  TEST_KEY_RESOLVER
                ),
                Effect.flip
              );
              expect(error).toBeInstanceOf(ProtectedRuntimeReadError);
            }
            for (const request of [
              {
                ...fixture.request,
                bundleHash: otherHash,
              },
              {
                ...fixture.request,
                snapshotId: otherHash,
              },
            ]) {
              expect(
                yield* decodeProtectedRuntimeRow(row, request).pipe(
                  Effect.provideService(
                    ContentVerificationKeyResolver,
                    TEST_KEY_RESOLVER
                  ),
                  Effect.flip
                )
              ).toBeInstanceOf(ProtectedRuntimeReadError);
            }
          })
        );
      })
  );
  it.effect(
    "rejects excess request fields and an artifact whose signed body differs from its stored identity",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const fixture = yield* Effect.promise(() =>
              insertProtectedRuntime(tCtx)
            );
            expect(
              yield* readProtectedProgram({
                ...fixture.request,
                extra: true,
              }).pipe(Effect.provide(tryoutLayer), Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
              message: "Protected runtime request is invalid.",
            });
            const artifact = testSignedArtifact("snbt-quant", {
              contentKey: fixture.question.contentKey,
              rawMdx: "## Replaced signed question",
            });
            yield* Effect.gen(function* () {
              const stored = yield* Effect.promise(() =>
                tCtx.db
                  .query("contentArtifacts")
                  .withIndex("by_artifactHash", (index) =>
                    index.eq("artifactHash", fixture.question.artifactHash)
                  )
                  .unique()
              );
              if (stored === null) {
                return;
              }
              yield* Effect.promise(() =>
                tCtx.db.patch(stored._id, {
                  artifactJson: encodeArtifactJson(artifact),
                })
              );
            });
            expect(
              yield* readProtectedProgram(fixture.request).pipe(
                Effect.provide(tryoutLayer),
                Effect.flip
              )
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("mismatched content"),
            });
          })
        );
      })
  );
});
