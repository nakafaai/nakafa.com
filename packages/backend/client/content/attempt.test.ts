import { Ref } from "@confect/core";
import { assert, beforeEach, describe, it } from "@effect/vitest";
import { MAX_PROTECTED_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyAttemptContent } from "@repo/backend/client/content/attempt";
import {
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
} from "@repo/backend/client/content/errors";
import refs from "@repo/backend/confect/_generated/refs";
import {
  decodeArtifactJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/confect/contentRelease/parse";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
} from "@repo/backend/test/content/proof";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";

vi.mock("server-only", () => ({}));
async function setup(historical = false) {
  const t = createConvexTestWithBetterAuth();
  const seed = await t.mutation((ctx) => insertHistoryAttempt(ctx, historical));
  const owned = t.withIdentity({
    subject: seed.identity.authUserId,
    sessionId: seed.identity.sessionId,
  });
  const ref = refs.public.tryouts.queries.content.getBatch;
  const row = Ref.decodeReturnsSync(
    ref,
    await owned.query(Ref.getFunctionReference(ref), seed.request)
  );
  assert.isNotNull(row);
  const request = {
    bundleHash: seed.runtime.bundleHash,
    selectors: Arr.map(
      seed.request.selectors,
      ({ artifactHash, contentKey, delivery }) => ({
        artifactHash,
        contentKey,
        delivery,
      })
    ),
    snapshotId: seed.runtime.snapshotId,
  };
  return {
    request,
    row,
    seed,
  };
}
beforeEach(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW)));
describe("attempt content verification", () => {
  it.effect("recomputes both artifact and bundle payload hashes", () =>
    Effect.gen(function* () {
      const { request, row } = yield* Effect.promise(() => setup(true));
      const first = row.items[0];
      assert.isDefined(first);
      const artifact = yield* decodeArtifactJson(first.artifactJson);
      const bundle = yield* decodeTryoutRuntimeBundleJson(row.bundleJson);
      const changedArtifact = {
        ...first,
        artifactJson: yield* Schema.encodeEffect(JsonTextSchema)({
          ...artifact,
          payload: {
            ...artifact.payload,
            plainText: "Changed technical body",
          },
        }),
      };
      const changedBundle = yield* Schema.encodeEffect(JsonTextSchema)({
        ...bundle,
        payload: {
          ...bundle.payload,
          sourceGitSha: "b".repeat(40),
        },
      });
      for (const { bytes, expectedTag } of [
        {
          bytes: {
            ...row,
            items: [changedArtifact, ...row.items.slice(1)],
          },
          expectedTag: "ArtifactHashMismatchError",
        },
        {
          bytes: {
            ...row,
            bundleJson: changedBundle,
          },
          expectedTag: "TryoutRuntimeBundleHashMismatchError",
        },
      ]) {
        const error = yield* verifyAttemptContent(
          request,
          bytes,
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(error, ContentRuntimeVerificationError);
        assert.propertyVal(error.cause, "_tag", expectedTag);
      }
    })
  );
  for (const historical of [false, true]) {
    it.effect(
      `authenticates ${historical ? "retained choices-era" : "current"} bundle and artifact bytes`,
      () =>
        Effect.gen(function* () {
          const { request, row } = yield* Effect.promise(() =>
            setup(historical)
          );
          const verified = yield* verifyAttemptContent(
            request,
            row,
            TEST_PROOF_RENDERER
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          );
          assert.strictEqual(
            yield* Schema.encodeEffect(JsonTextSchema)(verified.bundle),
            row.bundleJson
          );
          assert.strictEqual(
            yield* Schema.encodeEffect(JsonTextSchema)(
              verified.items[0]?.artifact
            ),
            row.items[0]?.artifactJson
          );
        })
    );
  }
  it.effect(
    "rejects invalid requests, absence and oversized original bytes",
    () =>
      Effect.gen(function* () {
        const { request, row } = yield* Effect.promise(() => setup());
        const invalid = yield* verifyAttemptContent(
          {},
          row,
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(invalid, ContentRuntimeVerificationError);
        const missing = yield* verifyAttemptContent(
          request,
          null,
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(missing, ContentRuntimeMissingError);
        const large = yield* verifyAttemptContent(
          request,
          {
            ...row,
            bundleJson: "x".repeat(MAX_PROTECTED_RUNTIME_RESPONSE_BYTES),
          },
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(large, ContentRuntimeVerificationError);
      })
  );
  it.effect("rejects malformed stored JSON before rendering", () =>
    Effect.gen(function* () {
      const { request, row } = yield* Effect.promise(() => setup());
      const error = yield* verifyAttemptContent(
        request,
        {
          ...row,
          rendererJson: "{",
        },
        TEST_PROOF_RENDERER
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.flip
      );
      assert.instanceOf(error, ContentRuntimeVerificationError);
    })
  );
  it.effect(
    "verifies original artifact signatures rather than only advertised hashes",
    () =>
      Effect.gen(function* () {
        const { request, row } = yield* Effect.promise(() => setup(true));
        const first = row.items[0];
        assert.isDefined(first);
        const artifact = yield* decodeArtifactJson(first.artifactJson);
        const signature = `${artifact.signature.startsWith("A") ? "B" : "A"}${artifact.signature.slice(1)}`;
        const error = yield* verifyAttemptContent(
          request,
          {
            ...row,
            items: [
              {
                ...first,
                artifactJson: yield* Schema.encodeEffect(JsonTextSchema)({
                  ...artifact,
                  signature,
                }),
              },
              ...row.items.slice(1),
            ],
          },
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(error, ContentRuntimeVerificationError);
        assert.propertyVal(error.cause, "_tag", "SignatureInvalidError");
      })
  );
  it.effect(
    "verifies original bundle signatures and ordered artifact membership",
    () =>
      Effect.gen(function* () {
        const { request, row } = yield* Effect.promise(() => setup(true));
        const bundle = yield* decodeTryoutRuntimeBundleJson(row.bundleJson);
        const signature = `${bundle.signature.startsWith("A") ? "B" : "A"}${bundle.signature.slice(1)}`;
        const error = yield* verifyAttemptContent(
          request,
          {
            ...row,
            bundleJson: yield* Schema.encodeEffect(JsonTextSchema)({
              ...bundle,
              signature,
            }),
          },
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(error, ContentRuntimeVerificationError);
        assert.propertyVal(error.cause, "_tag", "SignatureInvalidError");
        const reordered = yield* verifyAttemptContent(
          request,
          {
            ...row,
            items: Arr.reverse(row.items),
          },
          TEST_PROOF_RENDERER
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        assert.instanceOf(reordered, ContentRuntimeVerificationError);
      })
  );
});
