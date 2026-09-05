import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import {
  decodeProtectedRuntimeRow,
  ProtectedRuntimeReadError,
} from "@repo/backend/content/tryout/exchange";
import { readProtectedProgram } from "@repo/backend/content/tryout/protected";
import { decodeTryoutRuntimeBundleJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  testSignedArtifact,
} from "@repo/backend/test/content/proof";
import { insertProtectedRuntime } from "@repo/backend/test/runtime/protected";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const otherHash = Sha256HashSchema.make(`sha256:${"9".repeat(64)}`);

describe("protected try-out exchange", () => {
  it.effect(
    "authenticates original question and answer bytes with the requested permanent bundle",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const fixture = yield* Effect.promise(() =>
          t.mutation(insertProtectedRuntime)
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readProtectedProgram({
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
                }).pipe(Effect.provide(convexTryoutLayer(ctx)))
              )
            )
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("changed its snapshot identity"),
            },
          })
        );
        const row = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readProtectedProgram(fixture.request).pipe(
                Effect.provide(convexTryoutLayer(ctx))
              )
            )
          )
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
          bundle: { bundleHash: fixture.request.bundleHash },
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

  it.effect(
    "rejects malformed bytes, invalid signatures, and a substituted request identity",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const fixture = yield* Effect.promise(() =>
          t.mutation(insertProtectedRuntime)
        );
        const row = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readProtectedProgram(fixture.request).pipe(
                Effect.provide(convexTryoutLayer(ctx))
              )
            )
          )
        );
        if (row === null) {
          return yield* Effect.die("Expected signed protected source bytes.");
        }
        const bundle = yield* decodeTryoutRuntimeBundleJson(row.bundleJson);
        for (const corrupt of [
          { ...row, rendererJson: "{" },
          {
            ...row,
            bundleJson: JSON.stringify({
              ...bundle,
              signature: "A".repeat(86),
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
          { ...fixture.request, bundleHash: otherHash },
          { ...fixture.request, snapshotId: otherHash },
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

  it.effect(
    "rejects excess request fields and an artifact whose signed body differs from its stored identity",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const fixture = yield* Effect.promise(() =>
          t.mutation(insertProtectedRuntime)
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readProtectedProgram({ ...fixture.request, extra: true }).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: "Protected runtime request is invalid.",
            },
          })
        );
        const artifact = testSignedArtifact("snbt-quant", {
          contentKey: fixture.question.contentKey,
          rawMdx: "## Replaced signed question",
        });
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const stored = await ctx.db
              .query("contentArtifacts")
              .withIndex("by_artifactHash", (index) =>
                index.eq("artifactHash", fixture.question.artifactHash)
              )
              .unique();
            if (stored === null) {
              return;
            }
            await ctx.db.patch(stored._id, {
              artifactJson: JSON.stringify(artifact),
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readProtectedProgram(fixture.request).pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("mismatched content"),
            },
          })
        );
      })
  );
});
