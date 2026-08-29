import { describe, expect, it } from "@effect/vitest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  dispatchRetirement,
  type RetirementGateway,
} from "@repo/backend/convex/contentRelease/retire";
import type { RetirementArgs } from "@repo/backend/convex/contentRelease/retire/spec";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { Effect, Ref } from "effect";

const TEST_ARGS = {
  observationId: "terminal-runtime-test",
  proof: {
    assetHash: `sha256:${"a".repeat(64)}`,
    sourceSha: "b".repeat(40),
  },
  receiptJson: "{}",
} satisfies RetirementArgs;
const TEST_RESULT = {
  deleted: 14,
  deletedLegacyBundles: 9,
  migrationId: "retained-tryout-history",
  observationId: TEST_ARGS.observationId,
  permanentAttempts: 1,
  receiptHash: `sha256:${"c".repeat(64)}`,
  retiredAt: 1,
} as const;
const TEST_PROOF_HASH = `sha256:${"d".repeat(64)}`;
const TEST_BUNDLE_JSON_HASH = `sha256:${"e".repeat(64)}`;
const TEST_RENDERER_JSON_HASH = `sha256:${"f".repeat(64)}`;

describe("contentRelease/retire", () => {
  it.effect(
    "authenticates every source before forwarding one exact proof",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeRuntimeIngressFixture();
        const commits = yield* Ref.make<
          readonly (RetirementArgs & { readonly runtimeProofHash: string })[]
        >([]);
        const gateway: RetirementGateway = {
          commit: (args) =>
            Ref.update(commits, (current) => [...current, args]).pipe(
              Effect.as(TEST_RESULT)
            ),
          loadBundle: () =>
            Effect.succeed({
              bundleJson: JSON.stringify(fixture.bundle),
              rendererJson: JSON.stringify(fixture.rendererManifest),
            }),
          loadInventory: Effect.succeed({
            bundles: [
              {
                bundleHash: fixture.bundle.bundleHash,
                bundleJsonHash: TEST_BUNDLE_JSON_HASH,
                rendererJsonHash: TEST_RENDERER_JSON_HASH,
              },
            ],
            hash: TEST_PROOF_HASH,
            permanentAttempts: 1,
          }),
        };

        expect(
          yield* dispatchRetirement(gateway, TEST_ARGS).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        ).toEqual(TEST_RESULT);
        expect(yield* Ref.get(commits)).toEqual([
          { ...TEST_ARGS, runtimeProofHash: TEST_PROOF_HASH },
        ]);
      })
  );

  it.effect("rejects changed signed bytes before the commit", () =>
    Effect.gen(function* () {
      const fixture = yield* makeRuntimeIngressFixture();
      const signature = fixture.bundle.signature;
      const changed = {
        ...fixture.bundle,
        signature: `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`,
      };
      const gateway: RetirementGateway = {
        commit: () => Effect.succeed(TEST_RESULT),
        loadBundle: () =>
          Effect.succeed({
            bundleJson: JSON.stringify(changed),
            rendererJson: JSON.stringify(fixture.rendererManifest),
          }),
        loadInventory: Effect.succeed({
          bundles: [
            {
              bundleHash: fixture.bundle.bundleHash,
              bundleJsonHash: TEST_BUNDLE_JSON_HASH,
              rendererJsonHash: TEST_RENDERER_JSON_HASH,
            },
          ],
          hash: TEST_PROOF_HASH,
          permanentAttempts: 1,
        }),
      };

      const failure = yield* dispatchRetirement(gateway, TEST_ARGS).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.flip
      );

      expect(failure).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );
});
