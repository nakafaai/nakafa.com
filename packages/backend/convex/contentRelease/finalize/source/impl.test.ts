import { describe, expect, it } from "@effect/vitest";
import { loadFinalizationSource } from "@repo/backend/convex/contentRelease/finalize/source/impl";
import { finalizationContract } from "@repo/backend/convex/contentRelease/finalize/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testTextHash } from "@repo/backend/test/content/release";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

class TestQueryError extends Schema.TaggedError<TestQueryError>()(
  "TestQueryError",
  { cause: Schema.Unknown }
) {}

describe("contentRelease/finalize/source", () => {
  it.effect("returns authenticated renderer bytes from one exact bundle", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* storeRuntimeFixture(target, fixture);

      const source = yield* Effect.promise(() =>
        target.query((ctx) =>
          runConvexProgram(
            loadFinalizationSource(
              ctx,
              {
                bundleHash: fixture.bundle.bundleHash,
                rendererManifestHash: fixture.rendererManifest.hash,
              },
              {
                ...finalizationContract,
                attempts: [],
                genesisBundleHash: fixture.bundle.bundleHash,
              }
            )
          )
        )
      );

      expect(source).toEqual({
        rendererJson: JSON.stringify(fixture.rendererManifest),
        rendererManifestHash: fixture.rendererManifest.hash,
        targets: [],
      });
    })
  );

  it.effect("rejects a changed renderer identity", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* storeRuntimeFixture(target, fixture);

      const failure = yield* Effect.tryPromise({
        try: () =>
          target.query((ctx) =>
            runConvexProgram(
              loadFinalizationSource(
                ctx,
                {
                  bundleHash: fixture.bundle.bundleHash,
                  rendererManifestHash: testTextHash(
                    "changed-finalization-renderer"
                  ),
                },
                {
                  ...finalizationContract,
                  attempts: [],
                  genesisBundleHash: fixture.bundle.bundleHash,
                }
              )
            )
          ),
        catch: (cause) => new TestQueryError({ cause }),
      }).pipe(Effect.flip);

      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    })
  );
});
