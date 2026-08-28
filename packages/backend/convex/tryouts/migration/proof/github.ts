"use node";

import { canonicalizeSignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import {
  TRYOUT_HISTORY_MIGRATION_RECEIPT_ASSET,
  TRYOUT_HISTORY_MIGRATION_REPOSITORY,
  type TryoutHistoryMigrationProof,
  tryoutHistoryMigrationReleaseTag,
  verifyTryoutHistoryMigrationProof,
} from "@nakafa/aksara-contracts/migration/tryout/history/proof";
import type { SignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

const GITHUB_API = "https://api.github.com";
const GITHUB_REQUEST_TIMEOUT = "10 seconds";
const GithubAssetSchema = Schema.Struct({
  browser_download_url: Schema.String,
  digest: Schema.String,
  name: Schema.String,
  size: Schema.Int,
  state: Schema.String,
});
const GithubReleaseSchema = Schema.Struct({
  assets: Schema.Array(GithubAssetSchema),
  draft: Schema.Boolean,
  immutable: Schema.Boolean,
  name: Schema.String,
  prerelease: Schema.Boolean,
  published_at: Schema.String,
  tag_name: Schema.String,
  target_commitish: Schema.String,
});
const GithubTagSchema = Schema.Struct({
  object: Schema.Struct({ sha: Schema.String, type: Schema.String }),
});
const GithubComparisonSchema = Schema.Struct({
  base_commit: Schema.Struct({ sha: Schema.String }),
  merge_base_commit: Schema.Struct({ sha: Schema.String }),
  status: Schema.String,
});

function proofFailure() {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: "Immutable migration receipt release proof could not be verified.",
  });
}

/** Applies the public GitHub API policy shared by every proof request. */
const requestGithub = Effect.fn("tryouts.migration.requestGithub")(function* (
  url: string
) {
  const client = yield* HttpClient.HttpClient;
  return yield* client
    .get(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "nakafa-migration-proof",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.timeout(GITHUB_REQUEST_TIMEOUT),
      Effect.mapError(proofFailure)
    );
});

function hasSameBytes(left: Uint8Array, right: Uint8Array) {
  return (
    left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index])
  );
}

/** Proves the exact receipt is permanent on Aksara main before any deletion. */
export const verifyImmutableMigrationReceipt = Effect.fn(
  "tryouts.migration.verifyImmutableReceipt"
)(function* (
  receipt: SignedTryoutHistoryMigrationReceipt,
  proof: TryoutHistoryMigrationProof
) {
  const verifiedProof = yield* verifyTryoutHistoryMigrationProof(
    receipt,
    proof
  ).pipe(Effect.mapError(contractFailure));
  const releaseTag = tryoutHistoryMigrationReleaseTag(
    receipt.payload.migrationId
  );
  const encodedTag = encodeURIComponent(releaseTag);
  const repositoryApi = `${GITHUB_API}/repos/${TRYOUT_HISTORY_MIGRATION_REPOSITORY}`;
  const releaseUrl = `${repositoryApi}/releases/tags/${encodedTag}`;
  const tagUrl = `${repositoryApi}/git/ref/tags/${encodedTag}`;
  const comparisonUrl = `${repositoryApi}/compare/${verifiedProof.sourceSha}...main`;
  const assetUrl = `https://github.com/${TRYOUT_HISTORY_MIGRATION_REPOSITORY}/releases/download/${encodedTag}/${TRYOUT_HISTORY_MIGRATION_RECEIPT_ASSET}`;
  const expectedBytes = new TextEncoder().encode(
    `${canonicalizeSignedTryoutHistoryMigrationReceipt(receipt)}\n`
  );
  const { comparison, release, tag } = yield* Effect.all({
    comparison: requestGithub(comparisonUrl).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(GithubComparisonSchema))
    ),
    release: requestGithub(releaseUrl).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(GithubReleaseSchema))
    ),
    tag: requestGithub(tagUrl).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(GithubTagSchema))
    ),
  }).pipe(Effect.mapError(proofFailure));
  const asset = release.assets[0];
  if (
    release.assets.length !== 1 ||
    !asset ||
    release.draft ||
    !release.immutable ||
    release.name !== releaseTag ||
    release.prerelease ||
    release.tag_name !== releaseTag ||
    release.target_commitish !== verifiedProof.sourceSha ||
    tag.object.type !== "commit" ||
    tag.object.sha !== verifiedProof.sourceSha ||
    (comparison.status !== "ahead" && comparison.status !== "identical") ||
    comparison.base_commit.sha !== verifiedProof.sourceSha ||
    comparison.merge_base_commit.sha !== verifiedProof.sourceSha ||
    asset.browser_download_url !== assetUrl ||
    asset.digest !== verifiedProof.assetHash ||
    asset.name !== TRYOUT_HISTORY_MIGRATION_RECEIPT_ASSET ||
    asset.size !== expectedBytes.byteLength ||
    asset.state !== "uploaded"
  ) {
    return yield* proofFailure();
  }
  const downloadedBytes = yield* requestGithub(assetUrl).pipe(
    Effect.flatMap((response) => response.arrayBuffer),
    Effect.map((buffer) => new Uint8Array(buffer)),
    Effect.mapError(proofFailure)
  );
  if (!hasSameBytes(downloadedBytes, expectedBytes)) {
    return yield* proofFailure();
  }
  return verifiedProof;
});
