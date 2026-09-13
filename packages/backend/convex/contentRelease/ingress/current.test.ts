// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  readCurrentPublication,
  readRecovery,
} from "@repo/backend/convex/contentRelease/ingress/current";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
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
import { Effect } from "effect";

/** Builds exact receipt counters for a signed query response under test. */
function completed(release: SignedContentRelease) {
  const m = release.manifest;
  return {
    releaseJson: JSON.stringify(release),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
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
      stagedSnapshotRows: Object.values(m.snapshots).reduce(
        (count, snapshot) =>
          count + (snapshot.mode === "replace" ? snapshot.rowCount : 0),
        0
      ),
    },
  };
}

/** Exercises the Node authentication boundary independently of the query validator. */
function current(stored: unknown) {
  const t = convexTest(schema, convexModules);
  return t.action((ctx) => {
    vi.spyOn(ctx, "runQuery").mockResolvedValue(stored);
    return runConvexProgram(
      readCurrentPublication(ctx).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
    );
  });
}

describe("authenticated current publication evidence", () => {
  it.effect(
    "authenticates the permanent runtime bundle with its active renderer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeRuntimeIngressFixture();
        yield* Effect.promise(() =>
          expect(
            current({
              active: completed(fixture.release),
              candidate: null,
              recovery: null,
              tryoutRuntimeBundleJson: JSON.stringify(fixture.bundle),
            })
          ).resolves.toMatchObject({ tryoutRuntimeBundle: fixture.bundle })
        );
      })
  );

  it.effect("rejects a permanent bundle without an active publication", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      yield* Effect.promise(() =>
        expect(
          current({
            active: null,
            candidate: null,
            recovery: null,
            tryoutRuntimeBundleJson: JSON.stringify(fixture.bundle),
          })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message: expect.stringContaining("without an active release"),
          },
        })
      );
    })
  );

  it.effect("rejects a permanent bundle whose signed payload was changed", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      yield* Effect.promise(() =>
        expect(
          current({
            active: completed(fixture.release),
            candidate: null,
            recovery: null,
            tryoutRuntimeBundleJson: JSON.stringify({
              ...fixture.bundle,
              signature: `${fixture.bundle.signature.startsWith("A") ? "B" : "A"}${fixture.bundle.signature.slice(1)}`,
            }),
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );

  it("rejects an authenticated candidate with an invalid durable phase", async () => {
    await expect(
      current({
        active: null,
        candidate: { ...completed(ingressRelease), phase: "completed" },
        recovery: null,
        tryoutRuntimeBundleJson: null,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Current release state violates its exact contract.",
      },
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
          return runConvexProgram(
            readRecovery(ctx, {
              recoveryId: ingressRecoveryId,
              releaseId:
                corruption === "identity" ? "release-other" : ingressReleaseId,
            }).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              )
            )
          );
        })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
          message: expect.stringContaining(
            corruption === "identity"
              ? "does not bind candidate"
              : "lost terminal evidence"
          ),
        },
      });
    }
  );
});
