// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_PROOF_RENDERER,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import {
  insertRuntimeIngressSource,
  makeRuntimeIngressFixture,
  makeRuntimeIngressRenderer,
  stageRuntimeIngress,
  TEST_RUNTIME_RELEASE_ID,
} from "@repo/backend/test/runtime/ingress";
import { convexTest } from "convex-test";
import { type Cause, Effect } from "effect";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_ID: keyId, TEST_KEY_RESOLVER: resolver } = await import(
    "@repo/backend/test/content/proof"
  );
  return {
    activeContentSigningKeyId: keyId,
    contentKeyResolver: resolver,
  };
});

/** Exposes a rejected test action as one assertion-ready message. */
const failureMessage = Effect.fn("test.runtime.failureMessage")(function* (
  program: Effect.Effect<unknown, Cause.UnknownError>
) {
  const failure = yield* Effect.flip(program);
  if (!(failure.cause instanceof Error)) {
    return yield* Effect.die("Expected an Error rejection from convex-test.");
  }
  return failure.cause.message;
});

describe("content release runtime bundle staging", () => {
  it.effect(
    "authenticates, stores, and idempotently reuses one exact bundle",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeRuntimeIngressFixture();
        yield* insertRuntimeIngressSource(t, fixture);

        const created = yield* stageRuntimeIngress(t, fixture);
        expect(created).toMatchObject({
          ok: true,
          operation: "stageTryoutRuntimeBundle",
          value: {
            bundleHash: fixture.bundle.bundleHash,
            created: 1,
            snapshotId: fixture.snapshot.snapshotId,
            unchanged: 0,
          },
        });
        const unchanged = yield* stageRuntimeIngress(t, fixture);
        expect(unchanged).toMatchObject({
          value: { created: 0, unchanged: 1 },
        });
        const stored = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
        );
        expect(stored).toEqual([
          expect.objectContaining({
            bundleHash: fixture.bundle.bundleHash,
            rendererManifestHash: fixture.rendererManifest.hash,
            snapshotId: fixture.snapshot.snapshotId,
            sourceReleaseId: TEST_RUNTIME_RELEASE_ID,
          }),
        ]);
      })
  );

  it.effect("accepts the result and distinct retained base pairs", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const result = yield* makeRuntimeIngressFixture(
        TEST_RUNTIME_RELEASE_ID,
        TEST_PROOF_RENDERER,
        { bundleSnapshot: "result", hasBaseSnapshot: true }
      );
      const retainedBase = yield* makeRuntimeIngressFixture(
        TEST_RUNTIME_RELEASE_ID,
        TEST_PROOF_RENDERER,
        { bundleSnapshot: "base", hasBaseSnapshot: true }
      );
      yield* insertRuntimeIngressSource(t, result);

      yield* stageRuntimeIngress(t, result);
      yield* stageRuntimeIngress(t, retainedBase);

      const stored = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
      );
      expect(stored.map(({ snapshotId }) => snapshotId).sort()).toEqual(
        [result.snapshot.snapshotId, retainedBase.snapshot.snapshotId].sort()
      );
    })
  );

  it.effect("rejects a third snapshot outside the signed transition", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture(
        TEST_RUNTIME_RELEASE_ID,
        TEST_PROOF_RENDERER,
        { hasBaseSnapshot: true }
      );
      const unrelated = yield* makeRuntimeIngressFixture(
        TEST_RUNTIME_RELEASE_ID,
        TEST_PROOF_RENDERER,
        { snapshotRouteCountDelta: 7 }
      );
      yield* insertRuntimeIngressSource(t, fixture);

      const message = yield* failureMessage(
        stageRuntimeIngress(t, {
          ...fixture,
          bundle: testSignedTryoutRuntimeBundle({
            release: fixture.release,
            rendererManifest: fixture.rendererManifest,
            snapshot: unrelated.snapshot,
          }),
          snapshot: unrelated.snapshot,
        })
      );
      expect(message).toContain("Content release verification failed");
    })
  );

  it.effect("rejects a tampered signature and an inactive signing key", () =>
    Effect.gen(function* () {
      const tamperedStore = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* insertRuntimeIngressSource(tamperedStore, fixture);
      const prefix = fixture.bundle.signature.startsWith("A") ? "B" : "A";
      const tampered = {
        ...fixture,
        bundle: {
          ...fixture.bundle,
          signature: Ed25519SignatureSchema.make(
            `${prefix}${fixture.bundle.signature.slice(1)}`
          ),
        },
      };

      const signatureFailure = yield* failureMessage(
        stageRuntimeIngress(tamperedStore, tampered)
      );
      expect(signatureFailure).toContain("Content release verification failed");

      const inactiveStore = convexTest(schema, convexModules);
      yield* insertRuntimeIngressSource(inactiveStore, fixture);
      const keyFailure = yield* failureMessage(
        stageRuntimeIngress(
          inactiveStore,
          fixture,
          SigningKeyIdSchema.make("inactive-key")
        )
      );
      expect(keyFailure).toContain("must use the active content signing key");
    })
  );

  it.effect("rejects source release, snapshot, and renderer drift", () =>
    Effect.gen(function* () {
      const staged = yield* makeRuntimeIngressFixture();
      const otherRenderer = makeRuntimeIngressRenderer();
      const drifts = yield* Effect.all([
        makeRuntimeIngressFixture(TEST_RUNTIME_RELEASE_ID, otherRenderer),
        makeRuntimeIngressFixture(
          TEST_RUNTIME_RELEASE_ID,
          TEST_PROOF_RENDERER,
          { sourceGitSha: "b".repeat(40) }
        ),
        makeRuntimeIngressFixture(
          TEST_RUNTIME_RELEASE_ID,
          TEST_PROOF_RENDERER,
          { snapshotRouteCountDelta: 1 }
        ),
      ]);

      for (const drift of drifts) {
        const t = convexTest(schema, convexModules);
        yield* insertRuntimeIngressSource(t, staged);
        yield* failureMessage(stageRuntimeIngress(t, drift));
      }
    })
  );

  it.effect("reuses one identical pair across source releases", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const first = yield* makeRuntimeIngressFixture();
      yield* insertRuntimeIngressSource(t, first);
      yield* stageRuntimeIngress(t, first);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const [release, state] = await Promise.all([
            ctx.db.query("contentReleases").unique(),
            ctx.db.query("contentState").unique(),
          ]);
          if (!(release && state)) {
            throw new Error("Expected one staged source release.");
          }
          await ctx.db.delete("contentReleases", release._id);
          await ctx.db.delete("contentState", state._id);
        })
      );
      const second = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-bundle-next")
      );
      yield* insertRuntimeIngressSource(t, second);

      const receipt = yield* stageRuntimeIngress(t, second);
      expect(receipt).toMatchObject({
        value: {
          bundleHash: first.bundle.bundleHash,
          created: 0,
          releaseId: second.release.manifest.releaseId,
          snapshotId: second.snapshot.snapshotId,
          unchanged: 1,
        },
      });
      const stored = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
      );
      expect(stored).toEqual([
        expect.objectContaining({
          bundleHash: first.bundle.bundleHash,
          sourceReleaseId: first.release.manifest.releaseId,
        }),
      ]);
    })
  );

  it.effect("backfills a verified pre-expansion release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* insertRuntimeIngressSource(t, fixture);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const release = await ctx.db.query("contentReleases").unique();
          if (!release) {
            throw new Error("Expected one staged source release.");
          }
          await ctx.db.patch("contentReleases", release._id, {
            status: "verified",
            tryoutRuntimeRequired: undefined,
          });
        })
      );

      const receipt = yield* stageRuntimeIngress(t, fixture);
      const stored = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
      );

      expect(receipt).toMatchObject({
        value: { created: 1, unchanged: 0 },
      });
      expect(stored).toEqual([
        expect.objectContaining({
          sourceReleaseId: fixture.release.manifest.releaseId,
        }),
      ]);
    })
  );

  it.effect("rejects changed stored bytes and a closed staging state", () =>
    Effect.gen(function* () {
      const damagedStore = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      yield* insertRuntimeIngressSource(damagedStore, fixture);
      yield* stageRuntimeIngress(damagedStore, fixture);
      yield* Effect.promise(() =>
        damagedStore.mutation(async (ctx) => {
          const row = await ctx.db.query("tryoutRuntimeBundles").unique();
          if (!row) {
            throw new Error("Expected one retained runtime bundle.");
          }
          await ctx.db.patch("tryoutRuntimeBundles", row._id, {
            bundleJson: "{}",
          });
        })
      );
      const damagedMessage = yield* failureMessage(
        stageRuntimeIngress(damagedStore, fixture)
      );
      expect(damagedMessage).toContain("reused with different bytes");

      const closedStore = convexTest(schema, convexModules);
      yield* insertRuntimeIngressSource(closedStore, fixture);
      yield* Effect.promise(() =>
        closedStore.mutation(async (ctx) => {
          const release = await ctx.db.query("contentReleases").unique();
          if (!release) {
            throw new Error("Expected one staged source release.");
          }
          await ctx.db.patch("contentReleases", release._id, {
            status: "verified",
          });
        })
      );
      const closedMessage = yield* failureMessage(
        stageRuntimeIngress(closedStore, fixture)
      );
      expect(closedMessage).toContain("no longer accepts");
    })
  );
});
