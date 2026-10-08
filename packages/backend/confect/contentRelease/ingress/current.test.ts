import { RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Ed25519SignatureSchema } from "@nakafa/aksara-contracts/ids";
import {
  type SignedContentRelease,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { SignedTryoutRuntimeBundleSchema } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import {
  readCurrentPublication,
  readRecovery,
} from "@repo/backend/confect/contentRelease/ingress/current";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  ingressRecovery,
  ingressRecoveryId,
  ingressRelease,
  ingressReleaseId,
} from "@repo/backend/test/content/ingress";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
} from "@repo/backend/test/content/proof";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";

const ReleaseJsonSchema = Schema.fromJsonString(SignedContentReleaseSchema);
const RendererJsonSchema = Schema.fromJsonString(
  RendererManifestEnvelopeSchema
);
const RuntimeBundleJsonSchema = Schema.fromJsonString(
  SignedTryoutRuntimeBundleSchema
);

/** Builds exact receipt counters for a signed query response under test. */
function completed(release: SignedContentRelease) {
  const m = release.manifest;
  return {
    releaseJson: Schema.encodeSync(ReleaseJsonSchema)(release),
    rendererJson: Schema.encodeSync(RendererJsonSchema)(TEST_PROOF_RENDERER),
    receipt: {
      activatedHeads: m.upsertCount,
      activeAppLocales: [...m.activeAppLocales],
      deletedHeads: m.deleteCount,
      manifestHash: release.manifestHash,
      projectionDigest: m.projectionDigest,
      releaseId: m.releaseId,
      resultCount: m.resultCount,
      resultDigest: m.resultDigest,
      routeDigest: m.routeDigest,
      snapshots: m.snapshots,
      stagedArtifacts: m.upsertCount,
      stagedItems: m.itemCount,
      stagedProjections: m.projectionCount,
      stagedRoutes: m.routeCount,
      stagedSnapshotRows: Arr.reduce(
        Rec.values(m.snapshots),
        0,
        (count, snapshot) =>
          count + (snapshot.mode === "replace" ? snapshot.rowCount : 0)
      ),
    },
  };
}

/** Exercises the Node authentication boundary independently of the query validator. */
function current(stored: unknown) {
  const t = convexTest(schema, convexModules);
  return t.action((ctx) => {
    vi.spyOn(ctx, "runQuery").mockResolvedValue(stored);
    return Effect.runPromise(
      readCurrentPublication().pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
      )
    );
  });
}
describe("authenticated current publication evidence", () => {
  it("rejects individually authentic releases that form an incoherent current pair", async () => {
    await expect(
      current({
        active: completed(ingressRelease),
        candidate: {
          ...completed(ingressRelease),
          phase: "verified",
        },
        recovery: null,
        tryoutRuntimeBundleJson: null,
      })
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Current release state violates its exact contract.",
    });
  });
  it.effect(
    "authenticates the permanent runtime bundle with its active renderer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeRuntimeIngressFixture();
        const tryoutRuntimeBundleJson = yield* Schema.encodeEffect(
          RuntimeBundleJsonSchema
        )(fixture.bundle);
        yield* Effect.promise(() =>
          expect(
            current({
              active: completed(fixture.release),
              candidate: null,
              recovery: null,
              tryoutRuntimeBundleJson,
            })
          ).resolves.toMatchObject({
            tryoutRuntimeBundle: fixture.bundle,
          })
        );
      })
  );
  it.effect("rejects a permanent bundle without an active publication", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const tryoutRuntimeBundleJson = yield* Schema.encodeEffect(
        RuntimeBundleJsonSchema
      )(fixture.bundle);
      yield* Effect.promise(() =>
        expect(
          current({
            active: null,
            candidate: null,
            recovery: null,
            tryoutRuntimeBundleJson,
          })
        ).rejects.toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining("without an active release"),
        })
      );
    })
  );
  it.effect("rejects a permanent bundle whose signed payload was changed", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const tryoutRuntimeBundleJson = yield* Schema.encodeEffect(
        RuntimeBundleJsonSchema
      )({
        ...fixture.bundle,
        signature: Ed25519SignatureSchema.make(
          `${fixture.bundle.signature.startsWith("A") ? "B" : "A"}${fixture.bundle.signature.slice(1)}`
        ),
      });
      yield* Effect.promise(() =>
        expect(
          current({
            active: completed(fixture.release),
            candidate: null,
            recovery: null,
            tryoutRuntimeBundleJson,
          })
        ).rejects.toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
        })
      );
    })
  );
  it("rejects an authenticated candidate with an invalid durable phase", async () => {
    await expect(
      current({
        active: null,
        candidate: {
          ...completed(ingressRelease),
          phase: "completed",
        },
        recovery: null,
        tryoutRuntimeBundleJson: null,
      })
    ).rejects.toMatchObject({
      _tag: "SchemaError",
      message: expect.stringContaining('["candidate"]["phase"]'),
    });
  });
  it.each(["identity", "receipt"] as const)(
    "rejects recovery %s that no longer binds the original candidate",
    async (corruption) => {
      const value = completed(ingressRecovery);
      const t = convexTest(schema, convexModules);
      await expect(
        t.action((ctx) => {
          vi.spyOn(ctx, "runQuery").mockResolvedValue({
            kind: "completed",
            value: {
              ...value,
              receipt:
                corruption === "receipt"
                  ? {
                      ...value.receipt,
                      manifestHash: ingressRelease.manifestHash,
                    }
                  : value.receipt,
            },
          });
          return Effect.runPromise(
            readRecovery({
              recoveryId: ingressRecoveryId,
              releaseId:
                corruption === "identity" ? "release-other" : ingressReleaseId,
            }).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              ),
              Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
            )
          );
        })
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining(
          corruption === "identity"
            ? "does not bind candidate"
            : "lost terminal evidence"
        ),
      });
    }
  );
});
