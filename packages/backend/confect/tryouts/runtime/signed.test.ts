import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  encodeRendererJson,
  encodeTryoutRuntimeBundleJson,
} from "@repo/backend/confect/contentRelease/wire";
import { convexModules } from "@repo/backend/confect/test.setup";
import {
  stageTryoutRuntimeBundleProgram,
  storeAuthenticatedTryoutRuntimeBundle,
} from "@repo/backend/confect/tryouts/runtime/signed";
import schema from "@repo/backend/convex/schema";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import {
  makeRuntimeIngressFixture,
  makeRuntimeIngressRenderer,
} from "@repo/backend/test/runtime/ingress";
import { encodePrettyJsonText, JsonTextSchema } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { Cause, Effect, Exit, Schema } from "effect";

/** Returns the complete failure cause from one rejected Convex test program. */
const failureCause = Effect.fn("test.runtime.failureCause")(function* (
  program: Effect.Effect<unknown>
) {
  const exit = yield* Effect.exit(program);
  if (Exit.isSuccess(exit)) {
    return yield* Effect.die("Expected runtime storage to fail.");
  }
  return Cause.squash(exit.cause);
});
describe("tryouts/runtime signed storage", () => {
  it.effect("rejects a renderer that does not match the bundle payload", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      const message = yield* failureCause(
        Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              storeAuthenticatedTryoutRuntimeBundle(
                fixture.bundle,
                makeRuntimeIngressRenderer()
              ).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        )
      );
      expect(message).toMatchObject({
        message: expect.stringContaining(
          "has incoherent renderer or snapshot bytes"
        ),
      });
    })
  );
  it.effect(
    "rejects a staged bundle whose renderer is not its signed source",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeRuntimeIngressFixture();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertSignedCandidate(
              ctx,
              fixture.release.manifest.releaseId,
              fixture.release,
              encodeRendererJson(fixture.rendererManifest)
            )
          )
        );
        const message = yield* failureCause(
          Effect.promise(() =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                stageTryoutRuntimeBundleProgram(
                  encodeTryoutRuntimeBundleJson(fixture.bundle),
                  encodeRendererJson(makeRuntimeIngressRenderer())
                ).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            )
          )
        );
        expect(message).toMatchObject({
          message: expect.stringContaining(
            "does not match its staged source release"
          ),
        });
      })
  );
  it.effect("reuses one immutable pair across signed source releases", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const first = yield* makeRuntimeIngressFixture();
      const second = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-bundle-next")
      );
      const created = yield* storeRuntimeFixture(t, first);
      const reused = yield* storeRuntimeFixture(t, second);
      const stored = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
      );
      expect(created).toMatchObject({
        created: 1,
        unchanged: 0,
      });
      expect(reused).toMatchObject({
        bundleHash: first.bundle.bundleHash,
        created: 0,
        releaseId: second.release.manifest.releaseId,
        unchanged: 1,
      });
      expect(stored).toEqual([
        expect.objectContaining({
          bundleHash: first.bundle.bundleHash,
          sourceReleaseId: first.release.manifest.releaseId,
        }),
      ]);
    })
  );
  it.effect("rejects every corrupted duplicate fact on hash replay", () =>
    Effect.gen(function* () {
      const corruptions = [
        {
          bundleHash: `sha256:${"2".repeat(64)}`,
        },
        {
          rendererManifestHash: `sha256:${"3".repeat(64)}`,
        },
        {
          snapshotId: `sha256:${"4".repeat(64)}`,
        },
        {
          sourceGitSha: "b".repeat(40),
        },
        {
          sourceManifestHash: `sha256:${"5".repeat(64)}`,
        },
        {
          sourceReleaseId: "release-corrupted",
        },
      ] as const;
      for (const corruption of corruptions) {
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeRuntimeIngressFixture();
        yield* storeRuntimeFixture(t, fixture);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
            expect(stored).not.toBeNull();
            if (stored) {
              await ctx.db.patch(
                "tryoutRuntimeBundles",
                stored._id,
                corruption
              );
            }
          })
        );
        const message = yield* failureCause(storeRuntimeFixture(t, fixture));
        expect(message).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      }
    })
  );
  it.effect("rejects changed hash bytes and pair bytes", () =>
    Effect.gen(function* () {
      const hashStore = convexTest(schema, convexModules);
      const first = yield* makeRuntimeIngressFixture();
      yield* storeRuntimeFixture(hashStore, first);
      yield* Effect.promise(() =>
        hashStore.mutation(async (ctx) => {
          const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
          expect(stored).not.toBeNull();
          if (stored) {
            await ctx.db.patch("tryoutRuntimeBundles", stored._id, {
              bundleJson: "{}",
            });
          }
        })
      );
      const hashMessage = yield* failureCause(
        storeRuntimeFixture(hashStore, first)
      );
      expect(hashMessage).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_CONFLICT",
      });
      const pairStore = convexTest(schema, convexModules);
      const second = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-bundle-next")
      );
      yield* storeRuntimeFixture(pairStore, first);
      yield* Effect.promise(() =>
        pairStore.mutation(async (ctx) => {
          const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
          expect(stored).not.toBeNull();
          if (stored) {
            await ctx.db.patch("tryoutRuntimeBundles", stored._id, {
              rendererJson: encodePrettyJsonText(
                Schema.decodeSync(JsonTextSchema)(stored.rendererJson)
              ),
            });
          }
        })
      );
      const pairMessage = yield* failureCause(
        storeRuntimeFixture(pairStore, second)
      );
      expect(pairMessage).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_CONFLICT",
      });
    })
  );
  it.effect("replays one identical bundle as an unchanged receipt", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      const created = yield* storeRuntimeFixture(t, fixture);
      const replayed = yield* storeRuntimeFixture(t, fixture);
      expect(created).toMatchObject({
        created: 1,
        unchanged: 0,
      });
      expect(replayed).toMatchObject({
        bundleHash: fixture.bundle.bundleHash,
        created: 0,
        releaseId: fixture.release.manifest.releaseId,
        snapshotId: fixture.bundle.payload.snapshot.snapshotId,
        unchanged: 1,
      });
    })
  );
  it.effect("stages one signed bundle into its staged release", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            fixture.release.manifest.releaseId,
            fixture.release,
            encodeRendererJson(fixture.rendererManifest)
          )
        )
      );
      const receipt = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            stageTryoutRuntimeBundleProgram(
              encodeTryoutRuntimeBundleJson(fixture.bundle),
              encodeRendererJson(fixture.rendererManifest)
            ).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(receipt).toMatchObject({
        bundleHash: fixture.bundle.bundleHash,
        created: 1,
        unchanged: 0,
      });
    })
  );
  it.effect(
    "stages one signed bundle into a verified release that needs no runtime",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeRuntimeIngressFixture();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertSignedCandidate(
              ctx,
              fixture.release.manifest.releaseId,
              fixture.release,
              encodeRendererJson(fixture.rendererManifest)
            )
          )
        );
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const release = await ctx.db.query("contentReleases").unique();
            expect(release).not.toBeNull();
            if (release) {
              await ctx.db.patch("contentReleases", release._id, {
                status: "verified",
                tryoutRuntimeRequired: undefined,
              });
            }
          })
        );
        const receipt = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageTryoutRuntimeBundleProgram(
                encodeTryoutRuntimeBundleJson(fixture.bundle),
                encodeRendererJson(fixture.rendererManifest)
              ).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        expect(receipt).toMatchObject({
          bundleHash: fixture.bundle.bundleHash,
          created: 1,
          unchanged: 0,
        });
      })
  );
  it.effect("rejects a stage once its release is aborting", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            fixture.release.manifest.releaseId,
            fixture.release,
            encodeRendererJson(fixture.rendererManifest)
          )
        )
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const release = await ctx.db.query("contentReleases").unique();
          expect(release).not.toBeNull();
          if (release) {
            await ctx.db.patch("contentReleases", release._id, {
              abortingAt: Date.UTC(2026, 6, 22, 13),
              status: "aborting",
            });
          }
        })
      );
      const message = yield* failureCause(
        Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageTryoutRuntimeBundleProgram(
                encodeTryoutRuntimeBundleJson(fixture.bundle),
                encodeRendererJson(fixture.rendererManifest)
              ).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        )
      );
      expect(message).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_STATE",
      });
    })
  );
});
