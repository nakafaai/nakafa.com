import { describe, expect, it } from "@effect/vitest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  dispatchFinalization,
  type FinalizationDispatchContract,
  type FinalizationGateway,
} from "@repo/backend/convex/contentRelease/finalize/dispatch";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
} from "@repo/backend/test/content/proof";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { Effect, Ref } from "effect";

const TEST_RECEIPT = {
  backfilledAttempts: 1,
  bundleCreated: 1,
  permanentAttempts: 25,
  placementCount: 270,
} as const;

describe("contentRelease/finalize/dispatch", () => {
  it.effect("verifies and forwards canonical genesis bytes once", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const writes = yield* Ref.make<
        readonly {
          readonly bundleJson: string;
          readonly rendererJson: string;
        }[]
      >([]);
      const gateway: FinalizationGateway = {
        backfill: (args) =>
          Ref.update(writes, (current) => [...current, args]).pipe(
            Effect.as(TEST_RECEIPT)
          ),
        loadSource: Effect.succeed({
          rendererJson: JSON.stringify(fixture.rendererManifest),
          rendererManifestHash: fixture.rendererManifest.hash,
        }),
      };
      const contract = {
        activeKeyId: TEST_KEY_ID,
        bundleHash: fixture.bundle.bundleHash,
      } satisfies FinalizationDispatchContract;

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
        }),
      };
      const failure = yield* dispatchFinalization(
        gateway,
        JSON.stringify(fixture.bundle),
        {
          activeKeyId: "inactive-test-key",
          bundleHash: fixture.bundle.bundleHash,
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
        {
          activeKeyId: TEST_KEY_ID,
          bundleHash: fixture.bundle.bundleHash,
        }
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
});
