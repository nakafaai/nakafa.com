// @vitest-environment node

import { assert, describe, it } from "@effect/vitest";
import { canonicalizeSignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import {
  hashTryoutHistoryMigrationReceiptAsset,
  TryoutHistoryMigrationProofSchema,
} from "@nakafa/aksara-contracts/migration/tryout/history/proof";
import {
  SignedTryoutHistoryMigrationReceiptSchema,
  TRYOUT_HISTORY_MIGRATION_RECEIPT_FORMAT,
} from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { verifyImmutableMigrationReceipt } from "@repo/backend/convex/tryouts/migration/proof/github";
import { Effect, Layer, Schema } from "effect";
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

const SOURCE_SHA = "a".repeat(40);
const receipt = Schema.decodeSync(SignedTryoutHistoryMigrationReceiptSchema)({
  keyId: "test-key",
  payload: {
    completion: {
      cleanupLimit: 115,
      completedAt: 10,
      migratedAttempts: 1,
      migratedScaleItems: 33,
      migratedScaleRuns: 1,
      migratedScaleVersions: 1,
      remainingMarkers: 0,
    },
    format: TRYOUT_HISTORY_MIGRATION_RECEIPT_FORMAT,
    migrationId: "test-migration",
    planHash: `sha256:${"1".repeat(64)}`,
    sourceSnapshotId: `sha256:${"2".repeat(64)}`,
    targetBundleHash: `sha256:${"3".repeat(64)}`,
    targetSnapshotId: `sha256:${"4".repeat(64)}`,
  },
  receiptHash: `sha256:${"5".repeat(64)}`,
  signature: "A".repeat(86),
});

interface GithubFixture {
  readonly assetBytes: Uint8Array;
  readonly assetHash: string;
  readonly comparisonStatus?: string;
  readonly immutable?: boolean;
  readonly requestStatus?: number;
}

function makeGithubClient({
  assetBytes,
  assetHash,
  comparisonStatus = "identical",
  immutable = true,
  requestStatus = 200,
}: GithubFixture) {
  const releaseTag = "migration-test-migration";
  const assetUrl = `https://github.com/nakafaai/aksara/releases/download/${releaseTag}/receipt.json`;
  return Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        if (requestStatus !== 200) {
          return HttpClientResponse.fromWeb(
            request,
            new Response(null, { status: requestStatus })
          );
        }
        if (request.url === assetUrl) {
          return HttpClientResponse.fromWeb(
            request,
            new Response(new TextDecoder().decode(assetBytes))
          );
        }
        if (request.url.includes("/compare/")) {
          return HttpClientResponse.fromWeb(
            request,
            Response.json({
              base_commit: { sha: SOURCE_SHA },
              merge_base_commit: { sha: SOURCE_SHA },
              status: comparisonStatus,
            })
          );
        }
        if (request.url.includes("/git/ref/tags/")) {
          return HttpClientResponse.fromWeb(
            request,
            Response.json({ object: { sha: SOURCE_SHA, type: "commit" } })
          );
        }
        return HttpClientResponse.fromWeb(
          request,
          Response.json({
            assets: [
              {
                browser_download_url: assetUrl,
                digest: assetHash,
                name: "receipt.json",
                size: assetBytes.byteLength,
                state: "uploaded",
              },
            ],
            draft: false,
            immutable,
            name: releaseTag,
            prerelease: false,
            published_at: "2026-08-27T00:00:00Z",
            tag_name: releaseTag,
            target_commitish: SOURCE_SHA,
          })
        );
      })
    )
  );
}

const proofFixture = Effect.fn("test.migration.proofFixture")(function* () {
  const assetHash = yield* hashTryoutHistoryMigrationReceiptAsset(receipt);
  const proof = yield* Schema.decodeEffect(TryoutHistoryMigrationProofSchema)({
    assetHash,
    sourceSha: SOURCE_SHA,
  });
  const assetBytes = new TextEncoder().encode(
    `${canonicalizeSignedTryoutHistoryMigrationReceipt(receipt)}\n`
  );
  return { assetBytes, assetHash, proof };
});

function assertProofFailure(error: unknown) {
  assert.ok(error instanceof ReleaseError);
  assert.strictEqual(error.code, "CONTENT_RELEASE_INTEGRITY");
  assert.strictEqual(
    error.message,
    "Immutable migration receipt release proof could not be verified."
  );
}

describe("tryouts/migration/proof/github", () => {
  it.effect("accepts one exact immutable receipt on Aksara main", () =>
    Effect.gen(function* () {
      const fixture = yield* proofFixture();
      const requests: HttpClientRequest.HttpClientRequest[] = [];
      const base = makeGithubClient(fixture);
      const observed = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.gen(function* () {
            requests.push(request);
            const client = yield* HttpClient.HttpClient;
            return yield* client.execute(request);
          }).pipe(Effect.provide(base))
        )
      );
      const result = yield* verifyImmutableMigrationReceipt(
        receipt,
        fixture.proof
      ).pipe(Effect.provide(observed));

      assert.deepStrictEqual(result, fixture.proof);
      assert.strictEqual(requests.length, 4);
      assert.ok(
        requests.every(
          (request) =>
            request.headers["user-agent"] === "nakafa-migration-proof"
        )
      );
    })
  );

  it.effect("rejects mutable release metadata", () =>
    Effect.gen(function* () {
      const fixture = yield* proofFixture();
      const error = yield* verifyImmutableMigrationReceipt(
        receipt,
        fixture.proof
      ).pipe(
        Effect.provide(makeGithubClient({ ...fixture, immutable: false })),
        Effect.flip
      );
      assertProofFailure(error);
    })
  );

  it.effect("rejects a release commit outside Aksara main", () =>
    Effect.gen(function* () {
      const fixture = yield* proofFixture();
      const error = yield* verifyImmutableMigrationReceipt(
        receipt,
        fixture.proof
      ).pipe(
        Effect.provide(
          makeGithubClient({ ...fixture, comparisonStatus: "diverged" })
        ),
        Effect.flip
      );
      assertProofFailure(error);
    })
  );

  it.effect("rejects downloaded bytes that differ from the receipt", () =>
    Effect.gen(function* () {
      const fixture = yield* proofFixture();
      const assetBytes = Uint8Array.from(fixture.assetBytes);
      assetBytes[assetBytes.length - 1] = 0;
      const error = yield* verifyImmutableMigrationReceipt(
        receipt,
        fixture.proof
      ).pipe(
        Effect.provide(makeGithubClient({ ...fixture, assetBytes })),
        Effect.flip
      );
      assertProofFailure(error);
    })
  );

  it.effect("maps unavailable GitHub evidence to a closed failure", () =>
    Effect.gen(function* () {
      const fixture = yield* proofFixture();
      const error = yield* verifyImmutableMigrationReceipt(
        receipt,
        fixture.proof
      ).pipe(
        Effect.provide(makeGithubClient({ ...fixture, requestStatus: 403 })),
        Effect.flip
      );
      assertProofFailure(error);
    })
  );
});
