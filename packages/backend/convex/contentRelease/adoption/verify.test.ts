// @vitest-environment node

import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema as AdoptionArtifactSchema } from "@nakafa/aksara-contracts/adoption/schema";
import { canonicalizeCompiledContentPayload } from "@nakafa/aksara-contracts/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement-hash";
import {
  verifyAdoptionArtifact,
  verifyAdoptionState,
} from "@repo/backend/convex/contentRelease/adoption/verify";
import {
  decodeReleaseJson,
  decodeSnapshotRowJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertAdoptionHistory } from "@repo/backend/test/content/adoption";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testSignedArtifact,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { Effect, Schema } from "effect";

const keys = generateKeyPairSync("ed25519");
const keyId = "adoption-test";
const resolver = ContentVerificationKeyResolver.of({
  resolve: (requested) =>
    requested === keyId
      ? Effect.succeed(
          keys.publicKey.export({ format: "pem", type: "spki" }).toString()
        )
      : Effect.fail(new SigningKeyNotFoundError({ keyId: requested })),
});

/** Signs real old/current wire bytes with a test-only key; no production signer involved. */
function artifact(options?: {
  retained?: boolean;
  compiledCode?: string;
  rawMdx?: string;
}) {
  const base = testSignedArtifact("mathematics", options);
  const current = canonicalizeCompiledContentPayload(base.payload).replace(
    '"requiredComponents":[]',
    '"requiredComponents":["p"]'
  );
  const canonical = options?.retained
    ? current.replace(
        '"requiredComponents":["p"]',
        '"requiredComponents":[{"name":"p","version":1}]'
      )
    : current;
  const artifactHash = `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
  const payload: unknown = JSON.parse(canonical);
  return Schema.decodeUnknownSync(AdoptionArtifactSchema)(
    {
      payload,
      artifactHash,
      keyId,
      signature: sign(
        null,
        Buffer.from(
          `nakafa.aksara.content-artifact\n${artifactHash}\n${canonical}`
        ),
        keys.privateKey
      ).toString("base64url"),
    },
    { onExcessProperty: "error" }
  );
}

async function storedPair(
  prior: ReturnType<typeof artifact>,
  next: ReturnType<typeof artifact>
) {
  const t = createConvexTestWithBetterAuth();
  return await t.mutation(async (ctx) => {
    const priorId = await ctx.db.insert("contentArtifacts", {
      artifactHash: prior.artifactHash,
      artifactJson: JSON.stringify(prior),
      createdAt: 1,
      retainUntil: 999,
    });
    const nextId = await ctx.db.insert("contentArtifacts", {
      artifactHash: next.artifactHash,
      artifactJson: JSON.stringify(next),
      createdAt: 1,
      retainUntil: 999,
    });
    const priorDoc = await ctx.db.get("contentArtifacts", priorId);
    const nextDoc = await ctx.db.get("contentArtifacts", nextId);
    if (!(priorDoc && nextDoc)) {
      throw new Error("Expected two signed artifact documents.");
    }
    return {
      prior: priorDoc,
      next: nextDoc,
      renderers: {
        oldRenderer: TEST_PROOF_RENDERER,
        newRenderer: TEST_PROOF_RENDERER,
      },
    };
  });
}

describe("contentRelease/adoption/verify", () => {
  it.effect(
    "authenticates original object requirements and accepts only the name-only conversion",
    () =>
      Effect.gen(function* () {
        const prior = artifact({ retained: true });
        const next = artifact();
        const pair = yield* Effect.promise(() => storedPair(prior, next));
        const result = yield* verifyAdoptionArtifact(pair).pipe(
          Effect.provideService(ContentVerificationKeyResolver, resolver)
        );
        expect(result.map((item) => item.artifactHash)).toEqual([
          prior.artifactHash,
          next.artifactHash,
        ]);
        expect(pair.prior.artifactJson).toContain('"version":1');
      })
  );

  it.effect(
    "rejects re-signed changes to executable bytes or authored source",
    () =>
      Effect.gen(function* () {
        for (const options of [
          { compiledCode: "return {changed:true};" },
          { rawMdx: "## Changed source" },
        ]) {
          const pair = yield* Effect.promise(() =>
            storedPair(artifact({ retained: true }), artifact(options))
          );
          const failure = yield* verifyAdoptionArtifact(pair).pipe(
            Effect.provideService(ContentVerificationKeyResolver, resolver),
            Effect.flip
          );
          expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
        }
      })
  );

  it.effect(
    "rejects byte tampering before treating a signed artifact as equivalent",
    () =>
      Effect.gen(function* () {
        const next = artifact();
        const tampered = yield* Schema.decodeUnknownEffect(
          AdoptionArtifactSchema
        )({
          ...next,
          payload: { ...next.payload, compiledCode: "return {tampered:true};" },
        });
        const pair = yield* Effect.promise(() =>
          storedPair(artifact({ retained: true }), tampered)
        );
        const failure = yield* verifyAdoptionArtifact(pair).pipe(
          Effect.provideService(ContentVerificationKeyResolver, resolver),
          Effect.flip
        );
        expect(failure.code).toBe("CONTENT_RELEASE_INTEGRITY");
      })
  );

  it.effect(
    "authenticates the candidate source bundle and rejects changed snapshot provenance",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const fixture = yield* Effect.promise(() =>
          t.mutation((ctx) => insertAdoptionHistory(ctx))
        );
        const result = yield* verifyAdoptionState(fixture.state).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        );
        expect(result.newRenderer.hash).toBe(TEST_PROOF_RENDERER.hash);
        const failed = yield* verifyAdoptionState({
          ...fixture.state,
          newSnapshot: {
            ...fixture.state.newSnapshot,
            snapshotJson: fixture.state.oldSnapshot.snapshotJson,
          },
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        expect(failed.code).toBe("CONTENT_RELEASE_INTEGRITY");
      })
  );
  it.effect(
    "rejects a signed target that still uses the retired renderer envelope",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const fixture = yield* Effect.promise(() =>
          t.mutation((ctx) => insertAdoptionHistory(ctx))
        );
        const base = {
          authoringComponents: [{ name: "p", version: 1 }],
          supportedComponents: [{ name: "p", version: 1 }],
        };
        const domains = TEST_PROOF_RENDERER.domains.map(({ name }) => ({
          name,
          authoringComponents: [],
          supportedComponents: [],
        }));
        const hash = Sha256HashSchema.make(
          `sha256:${createHash("sha256")
            .update(
              JSON.stringify([
                "nakafa-mdx-renderer-v1",
                "1.0.0",
                base,
                domains,
                TEST_PROOF_RENDERER.publishedDomains,
              ])
            )
            .digest("hex")}`
        );
        const retained = {
          base,
          domains,
          format: "nakafa-mdx-renderer-v1",
          hash,
          publishedDomains: TEST_PROOF_RENDERER.publishedDomains,
          rendererContractVersion: "1.0.0",
        };
        const originalRelease = yield* decodeReleaseJson(
          fixture.state.release.releaseJson
        );
        const release = testSignedRelease({
          ...originalRelease.manifest,
          rendererManifestHash: hash,
        });
        const originalBundle = yield* decodeTryoutRuntimeBundleJson(
          fixture.state.newBundle.bundleJson
        );
        const bundle = testSignedTryoutRuntimeBundle({
          release,
          rendererManifest: { ...TEST_PROOF_RENDERER, hash },
          snapshot: originalBundle.payload.snapshot,
        });
        const failure = yield* verifyAdoptionState({
          ...fixture.state,
          release: {
            ...fixture.state.release,
            releaseJson: JSON.stringify(release),
          },
          newBundle: {
            ...fixture.state.newBundle,
            rendererJson: JSON.stringify(retained),
            bundleJson: JSON.stringify(bundle),
          },
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        expect(failure.code).toBe("CONTENT_RELEASE_UNSUPPORTED");
      })
  );

  it.effect(
    "rejects rehashed semantic placement changes and altered frozen learner source",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const fixture = yield* Effect.promise(() =>
          t.mutation((ctx) => insertAdoptionHistory(ctx))
        );
        const pair = fixture.state.placements[0];
        if (!pair) {
          throw new Error("Expected signed membership.");
        }
        const decoded = yield* decodeSnapshotRowJson(pair.next.rowJson);
        if (decoded.family !== "tryout" || decoded.rowKind !== "placement") {
          throw new Error("Expected placement.");
        }
        const record = makeTryoutPlacementRecord({
          ...decoded.record.row,
          sourceRevision: "changed-source",
        });
        const placementFailure = yield* verifyAdoptionState({
          ...fixture.state,
          placements: [
            {
              ...pair,
              next: {
                ...pair.next,
                rowHash: record.rowHash,
                rowJson: JSON.stringify({ ...decoded, record }),
              },
            },
          ],
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        expect(placementFailure.code).toBe("CONTENT_RELEASE_INTEGRITY");
        const historyFailure = yield* verifyAdoptionState({
          ...fixture.state,
          history: {
            ...fixture.state.history,
            entries: fixture.state.history.entries.map((entry) => ({
              ...entry,
              placements: entry.placements.map((placement) => ({
                ...placement,
                sourceRevision: "different-source",
              })),
            })),
          },
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        expect(historyFailure.code).toBe("CONTENT_RELEASE_INTEGRITY");
      })
  );
});
