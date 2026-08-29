import { describe, expect, it } from "@effect/vitest";
import { findReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/binding";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import {
  makeRuntimeIngressFixture,
  type RuntimeIngressFixture,
} from "@repo/backend/test/runtime/ingress";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

/** Reads one release binding through the production Effect boundary. */
function findRuntime(
  t: TestConvex<typeof schema>,
  signed: RuntimeIngressFixture["release"],
  bundleHash?: string
) {
  return t.query((ctx) =>
    runConvexProgram(findReleaseTryoutRuntime(ctx, signed, bundleHash))
  );
}

describe("contentRelease/tryout binding", () => {
  it.effect("resolves the exact permanent runtime pair", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const t = convexTest(schema, convexModules);
      yield* storeRuntimeFixture(t, fixture);

      const runtime = yield* Effect.promise(() =>
        findRuntime(t, fixture.release, fixture.bundle.bundleHash)
      );

      expect(runtime.retainedBase).toBeNull();
      expect(runtime.result?.stored).toMatchObject({
        bundleHash: fixture.bundle.bundleHash,
        snapshotId: fixture.snapshot.snapshotId,
        sourceReleaseId: fixture.release.manifest.releaseId,
      });
    })
  );

  it.effect("fails closed for an absent or unbound permanent pair", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const missing = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        expect(
          findRuntime(missing, fixture.release, fixture.bundle.bundleHash)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );

      const unbound = convexTest(schema, convexModules);
      yield* storeRuntimeFixture(unbound, fixture);
      yield* Effect.promise(() =>
        expect(findRuntime(unbound, fixture.release)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
