"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import type {
  RendererContractVersion,
  RendererManifestEnvelope,
} from "@nakafa/aksara-contracts/renderer/contract";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { CUTOVER_AUDIT_PAGE_BYTES } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeArtifactJson,
  decodeReleaseJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { decodeHistoryRowJson } from "@repo/backend/convex/tryouts/history/decode";
import {
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { makeFunctionReference, type PaginationOptions } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const RETAINED_ARTIFACT_PAGE_SIZE = 8;

interface RetainedArtifactPage {
  readonly cursor: string;
  readonly done: boolean;
  readonly rows: readonly {
    readonly answerArtifactJson: string;
    readonly questionArtifactJson: string;
    readonly rowHash: string;
    readonly rowJson: string;
  }[];
}

interface RetainedBundle {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly releaseJson: string;
  readonly rendererJson: string;
  readonly snapshotId: string;
}

const artifactPageReference = makeFunctionReference<
  "query",
  { paginationOpts: PaginationOptions; snapshotId: string },
  RetainedArtifactPage
>("contentRelease/cutover/retention:artifactPage");
const retainedBundleReference = makeFunctionReference<
  "query",
  { releaseId: string },
  RetainedBundle
>("contentRelease/cutover/retention:retainedBundle");

const retainedArtifactReceiptValidator = v.object({
  artifacts: v.number(),
  placements: v.number(),
});

/** Reauthenticates every artifact retained by the exact historical snapshot. */
export const verify = internalAction({
  args: {},
  returns: retainedArtifactReceiptValidator,
  handler: (ctx) =>
    runConvexProgram(
      verifyRetainedArtifacts(ctx).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});

/** Authenticates all retained bytes in bounded pages on one Node worker. */
export const verifyRetainedArtifacts = Effect.fn(
  "contentRelease.cutover.verifyRetainedArtifacts"
)(function* (ctx: ActionCtx, plan = retainedTryoutHistoryPlan) {
  const { release, renderer } = yield* loadRetainedArtifactIdentity(ctx, plan);
  const hashes = new Set<string>();
  let placements = 0;
  let cursor: null | string = null;

  while (true) {
    const page = yield* callInternal(() =>
      ctx.runQuery(artifactPageReference, {
        paginationOpts: {
          cursor,
          maximumBytesRead: CUTOVER_AUDIT_PAGE_BYTES,
          maximumRowsRead: RETAINED_ARTIFACT_PAGE_SIZE,
          numItems: RETAINED_ARTIFACT_PAGE_SIZE,
        },
        snapshotId: plan.snapshotId,
      })
    );

    for (const row of page.rows) {
      const decoded = yield* decodeHistoryRowJson(
        row.rowJson,
        row.rowHash
      ).pipe(
        Effect.mapError((error) =>
          artifactError(`History row ${row.rowHash}: ${error.message}`)
        )
      );
      if (decoded.rowKind !== "placement") {
        return yield* artifactFailure(
          `Catalog row ${row.rowHash} entered retained artifact verification.`
        );
      }
      const placement = decoded.record.row;
      const [answerHash, questionHash] = yield* Effect.all([
        verifyRetainedArtifact(
          row.answerArtifactJson,
          placement.answerArtifactHash,
          placement.answerContentKey,
          placement.rendererDomain,
          renderer,
          release.manifest.rendererContractVersion
        ),
        verifyRetainedArtifact(
          row.questionArtifactJson,
          placement.questionArtifactHash,
          placement.questionContentKey,
          placement.rendererDomain,
          renderer,
          release.manifest.rendererContractVersion
        ),
      ]);
      hashes.add(answerHash);
      hashes.add(questionHash);
      placements += 1;
    }

    if (page.done) {
      break;
    }
    if (page.cursor === cursor) {
      return yield* artifactFailure(
        "Retained artifact verification cursor stopped advancing."
      );
    }
    cursor = page.cursor;
  }

  if (
    placements !== plan.placementRowCount ||
    hashes.size !== plan.artifactCount
  ) {
    return yield* artifactFailure(
      `Found ${placements} placements and ${hashes.size} unique authenticated artifacts.`
    );
  }
  return { artifacts: hashes.size, placements };
});

/** Authenticates the exact release and renderer used for every artifact. */
const loadRetainedArtifactIdentity = Effect.fn(
  "contentRelease.cutover.loadRetainedArtifactIdentity"
)(function* (ctx: ActionCtx, plan: RetainedTryoutHistoryPlan) {
  const expected = plan.releases[0];
  if (!expected) {
    return yield* artifactFailure("The retained release plan is empty.");
  }
  const bundle = yield* callInternal(() =>
    ctx.runQuery(retainedBundleReference, { releaseId: expected.releaseId })
  );
  const storedRelease = yield* decodeReleaseJson(bundle.releaseJson);
  const release = yield* verifySignedContentRelease(storedRelease).pipe(
    Effect.mapError(contractFailure)
  );
  const storedRenderer = yield* decodeRendererJson(bundle.rendererJson);
  const renderer = yield* validateRendererManifestHash(storedRenderer).pipe(
    Effect.mapError(contractFailure)
  );
  if (
    bundle.releaseId !== expected.releaseId ||
    bundle.manifestHash !== expected.manifestHash ||
    bundle.snapshotId !== plan.snapshotId ||
    release.manifest.releaseId !== expected.releaseId ||
    release.manifestHash !== expected.manifestHash ||
    release.manifest.snapshots.tryout.resultSnapshotId !== plan.snapshotId ||
    !hasRendererIdentity(release.manifest, renderer)
  ) {
    return yield* artifactFailure(
      `Retained bundle ${bundle.releaseId} lost its exact signed identity.`
    );
  }
  return { release, renderer };
});

/** Verifies one immutable artifact against its authenticated placement facts. */
const verifyRetainedArtifact = Effect.fn(
  "contentRelease.cutover.verifyRetainedArtifact"
)(function* (
  artifactJson: string,
  artifactHash: string,
  contentKey: string,
  rendererDomain: string,
  renderer: RendererManifestEnvelope,
  rendererContractVersion: RendererContractVersion
) {
  const artifact = yield* decodeArtifactJson(artifactJson);
  const verified = yield* verifySignedContentArtifact({
    artifact,
    rendererContractVersion,
    rendererManifest: renderer,
  }).pipe(Effect.mapError(contractFailure));
  if (
    verified.artifactHash !== artifactHash ||
    verified.payload.contentKey !== contentKey ||
    verified.payload.rendererDomain !== rendererDomain
  ) {
    return yield* artifactFailure(
      `Artifact ${artifactHash} does not match its retained placement.`
    );
  }
  return verified.artifactHash;
});

function artifactFailure(message: string) {
  return Effect.fail(artifactError(message));
}

function artifactError(message: string) {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: `Cutover artifact proof: ${message}`,
  });
}
