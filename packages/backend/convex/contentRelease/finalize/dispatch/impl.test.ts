import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  dispatchFinalization,
  type FinalizationDispatchContract,
  type FinalizationGateway,
} from "@repo/backend/convex/contentRelease/finalize/dispatch/impl";
import {
  type FinalizationBackfillArgs,
  finalizationContract,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
} from "@repo/backend/test/content/proof";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { convexTest } from "convex-test";
import { Effect, Ref } from "effect";

const TEST_RECEIPT = {
  backfilledAttempts: 1,
  bundleCreated: 1,
  permanentAttempts: 25,
  placementCount: 270,
} as const;
const SHA_256_PATTERN = /^sha256:[0-9a-f]{64}$/;

function makeDispatchContract(
  genesisBundleHash: FinalizationDispatchContract["finalization"]["genesisBundleHash"],
  attempts: FinalizationDispatchContract["finalization"]["attempts"] = []
): FinalizationDispatchContract {
  return {
    activeKeyId: TEST_KEY_ID,
    finalization: { attempts, genesisBundleHash },
  };
}

describe("contentRelease/finalize/dispatch", () => {
  it.effect("verifies and forwards canonical genesis bytes once", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const writes = yield* Ref.make<readonly FinalizationBackfillArgs[]>([]);
      const gateway: FinalizationGateway = {
        backfill: (args) =>
          Ref.update(writes, (current) => [...current, args]).pipe(
            Effect.as(TEST_RECEIPT)
          ),
        loadSource: Effect.succeed({
          rendererJson: JSON.stringify(fixture.rendererManifest),
          rendererManifestHash: fixture.rendererManifest.hash,
          targets: [],
        }),
      };
      const contract = makeDispatchContract(fixture.bundle.bundleHash);

      expect(
        yield* dispatchFinalization(
          gateway,
          JSON.stringify(fixture.bundle),
          contract
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      ).toEqual(TEST_RECEIPT);
      const forwarded = yield* Ref.get(writes);
      expect(forwarded).toHaveLength(1);
      expect(JSON.parse(forwarded[0]?.bundleJson ?? "null")).toEqual(
        fixture.bundle
      );
      expect(JSON.parse(forwarded[0]?.rendererJson ?? "null")).toEqual(
        fixture.rendererManifest
      );
      expect(forwarded[0]?.targetProofHash).toMatch(SHA_256_PATTERN);
    })
  );

  it.effect("rejects a retained but inactive signing key", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const gateway: FinalizationGateway = {
        backfill: () => Effect.succeed(TEST_RECEIPT),
        loadSource: Effect.succeed({
          rendererJson: JSON.stringify(fixture.rendererManifest),
          rendererManifestHash: fixture.rendererManifest.hash,
          targets: [],
        }),
      };
      const failure = yield* dispatchFinalization(
        gateway,
        JSON.stringify(fixture.bundle),
        {
          activeKeyId: "inactive-test-key",
          finalization: {
            attempts: [],
            genesisBundleHash: fixture.bundle.bundleHash,
          },
        }
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.flip
      );

      expect(failure.code).toBe("CONTENT_RELEASE_UNSUPPORTED");
    })
  );

  it.effect("rejects changed signed bundle bytes", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const gateway: FinalizationGateway = {
        backfill: () => Effect.succeed(TEST_RECEIPT),
        loadSource: Effect.succeed({
          rendererJson: JSON.stringify(fixture.rendererManifest),
          rendererManifestHash: fixture.rendererManifest.hash,
          targets: [],
        }),
      };
      const signature = fixture.bundle.signature;
      const changedBundle = {
        ...fixture.bundle,
        signature: `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`,
      };
      const failure = yield* dispatchFinalization(
        gateway,
        JSON.stringify(changedBundle),
        makeDispatchContract(fixture.bundle.bundleHash)
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.flip
      );

      expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
    })
  );

  it.effect("rejects a schema-valid invalid target signature", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const genesis = yield* makeRuntimeIngressFixture();
      const existing = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-target"),
        genesis.rendererManifest,
        { sourceGitSha: "c".repeat(40) }
      );
      yield* storeRuntimeFixture(target, existing);
      const stored = yield* Effect.promise(() =>
        target.run((ctx) =>
          ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (query) =>
              query.eq("bundleHash", existing.bundle.bundleHash)
            )
            .unique()
        )
      );
      const attempt = finalizationContract.attempts[0];
      if (!(stored && attempt)) {
        return yield* Effect.die("Expected one stored target fixture.");
      }
      const signature = existing.bundle.signature;
      const changedBundle = {
        ...existing.bundle,
        signature: `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`,
      };
      const writes = yield* Ref.make(0);
      const gateway: FinalizationGateway = {
        backfill: () =>
          Ref.update(writes, (count) => count + 1).pipe(
            Effect.as(TEST_RECEIPT)
          ),
        loadSource: Effect.succeed({
          rendererJson: JSON.stringify(genesis.rendererManifest),
          rendererManifestHash: genesis.rendererManifest.hash,
          targets: [
            {
              ...stored,
              bundleJson: JSON.stringify(changedBundle),
            },
          ],
        }),
      };
      const failure = yield* dispatchFinalization(
        gateway,
        JSON.stringify(genesis.bundle),
        makeDispatchContract(genesis.bundle.bundleHash, [
          { ...attempt, targetBundleHash: existing.bundle.bundleHash },
        ])
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.flip
      );

      expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
      expect(yield* Ref.get(writes)).toBe(0);
    })
  );
});
