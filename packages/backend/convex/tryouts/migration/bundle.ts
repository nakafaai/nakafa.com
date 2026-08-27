"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { hasLosslessHistoricalArtifactMapping } from "@nakafa/aksara-contracts/migration/tryout/history/lossless";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import type { TryoutHistoryMigrationRequest } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { requireActiveContentKey } from "@repo/backend/convex/contentRelease/ingress/key";
import { verifySnapshotManifest } from "@repo/backend/convex/contentRelease/ingress/snapshot";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  encodeArtifactJson,
  encodeRendererJson,
  encodeSnapshotJson,
  encodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/wire";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { loadMigrationArtifacts } from "@repo/backend/convex/tryouts/migration/read";
import type {
  bundleStageReceiptValidator,
  MapInput,
  simpleStageReceiptValidator,
  snapshotStageReceiptValidator,
} from "@repo/backend/convex/tryouts/migration/stage/schema";
import type { targetRuntimeValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type MigrationRequest = TryoutHistoryMigrationRequest;
type BundleRequest = Extract<
  MigrationRequest,
  { readonly command: "stageBundle" }
>;
type ArtifactRequest = Extract<
  MigrationRequest,
  { readonly command: "stageArtifacts" }
>;
type SnapshotRequest = Extract<
  MigrationRequest,
  { readonly command: "stageSnapshot" }
>;
type BundleReceipt = Infer<typeof bundleStageReceiptValidator>;
type StageReceipt = Infer<typeof simpleStageReceiptValidator>;
type SnapshotReceipt = Infer<typeof snapshotStageReceiptValidator>;
type TargetRuntime = Infer<typeof targetRuntimeValidator>;

const targetRuntimeReference = makeFunctionReference<
  "query",
  { migrationId: string },
  TargetRuntime
>("tryouts/migration/state/query:targetRuntime");
const stageBundleReference = makeFunctionReference<
  "mutation",
  { bundleJson: string; migrationId: string; rendererJson: string },
  BundleReceipt
>("tryouts/migration/stage/bundle:stageBundle");
const stageArtifactsReference = makeFunctionReference<
  "mutation",
  {
    entries: {
      artifactJson?: string;
      identity: string;
      index: number;
      kind: "artifact" | "catalog" | "placement";
      newHash: string;
      oldHash: string;
      rowJson?: string;
    }[];
    migrationId: string;
  },
  StageReceipt
>("tryouts/migration/stage/artifact:stageArtifacts");
const stageSnapshotReference = makeFunctionReference<
  "mutation",
  { migrationId: string; snapshotJson: string },
  SnapshotReceipt
>("tryouts/migration/stage/snapshot:stageSnapshot");

/** Loads and reauthenticates the staged runtime selected by a migration. */
export const loadMigrationTargetRuntime = Effect.fn(
  "tryouts.migration.loadTargetRuntime"
)(function* (ctx: Pick<ActionCtx, "runQuery">, migrationId: string) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(targetRuntimeReference, { migrationId })
  );
  if (!stored) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "Try-out history target runtime is not staged."
    );
  }
  const bundle = yield* decodeTryoutRuntimeBundleJson(stored.bundleJson);
  const rendererManifest = yield* decodeRendererJson(stored.rendererJson);
  const verified = yield* verifySignedTryoutRuntimeBundle({
    bundle,
    rendererManifest,
  }).pipe(Effect.mapError(contractFailure));
  return { bundle: verified, rendererManifest };
});

/** Authenticates and stages the permanent converted-history runtime bundle. */
export const stageMigrationBundle = Effect.fn(
  "tryouts.migration.stageBundleIngress"
)(function* (
  ctx: Pick<ActionCtx, "runMutation">,
  request: BundleRequest,
  activeKeyId: string
) {
  const rendererManifest = yield* validateRendererManifestHash(
    request.rendererManifest
  ).pipe(Effect.mapError(contractFailure));
  const bundle = yield* verifySignedTryoutRuntimeBundle({
    bundle: request.bundle,
    rendererManifest,
  }).pipe(Effect.mapError(contractFailure));
  yield* requireActiveContentKey(
    bundle.keyId,
    activeKeyId,
    `Try-out history bundle ${bundle.bundleHash}`
  );
  yield* verifySnapshotManifest({
    family: "tryout",
    manifest: bundle.payload.snapshot,
  });
  if (
    request.sourceSnapshotId !== retainedTryoutHistoryPlan.snapshotId ||
    bundle.payload.snapshot.snapshotId === request.sourceSnapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history bundle does not identify a converted snapshot."
    );
  }
  const receipt = yield* callInternal(() =>
    ctx.runMutation(stageBundleReference, {
      bundleJson: encodeTryoutRuntimeBundleJson(bundle),
      migrationId: request.releaseId,
      rendererJson: encodeRendererJson(rendererManifest),
    })
  );
  return {
    ...receipt,
    command: request.command,
    migrationId: request.releaseId,
  };
});

/** Authenticates each lossless artifact conversion before immutable staging. */
export const stageMigrationArtifacts = Effect.fn(
  "tryouts.migration.stageArtifactsIngress"
)(function* (
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  request: ArtifactRequest,
  activeKeyId: string
) {
  const target = yield* loadMigrationTargetRuntime(ctx, request.releaseId);
  const sources = yield* loadMigrationArtifacts(
    ctx,
    request.mappings.map(({ oldArtifactHash }) => oldArtifactHash),
    request.sourceSnapshotId
  );
  const entries = yield* Effect.forEach(
    request.mappings,
    (mapping, index) =>
      Effect.gen(function* () {
        const source = sources[index];
        if (
          !source ||
          source.artifactHash !== mapping.oldArtifactHash ||
          !hasLosslessHistoricalArtifactMapping(source, mapping.artifact)
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Try-out history artifact conversion is not lossless."
          );
        }
        const artifact = yield* verifySignedContentArtifact({
          artifact: mapping.artifact,
          rendererContractVersion:
            target.rendererManifest.rendererContractVersion,
          rendererManifest: target.rendererManifest,
        }).pipe(Effect.mapError(contractFailure));
        yield* requireActiveContentKey(
          artifact.keyId,
          activeKeyId,
          `Converted artifact ${artifact.artifactHash}`
        );
        return {
          artifactJson: encodeArtifactJson(artifact),
          identity: source.artifactHash,
          index: mapping.index,
          kind: "artifact",
          newHash: artifact.artifactHash,
          oldHash: source.artifactHash,
        } satisfies MapInput;
      }),
    { concurrency: "unbounded" }
  );
  const receipt = yield* callInternal(() =>
    ctx.runMutation(stageArtifactsReference, {
      entries,
      migrationId: request.releaseId,
    })
  );
  return {
    ...receipt,
    command: request.command,
    migrationId: request.releaseId,
  };
});

/** Verifies and stages the exact snapshot already signed by the target bundle. */
export const stageMigrationSnapshot = Effect.fn(
  "tryouts.migration.stageSnapshotIngress"
)(function* (
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  request: SnapshotRequest
) {
  const target = yield* loadMigrationTargetRuntime(ctx, request.releaseId);
  yield* verifySnapshotManifest({
    family: "tryout",
    manifest: request.snapshot,
  });
  if (
    request.sourceSnapshotId !== retainedTryoutHistoryPlan.snapshotId ||
    JSON.stringify(request.snapshot) !==
      JSON.stringify(target.bundle.payload.snapshot)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history snapshot differs from its permanent bundle."
    );
  }
  const receipt = yield* callInternal(() =>
    ctx.runMutation(stageSnapshotReference, {
      migrationId: request.releaseId,
      snapshotJson: encodeSnapshotJson({
        family: "tryout",
        manifest: request.snapshot,
      }),
    })
  );
  return {
    ...receipt,
    command: request.command,
    migrationId: request.releaseId,
  };
});
