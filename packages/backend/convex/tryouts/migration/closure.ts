"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import { MAX_TRYOUT_HISTORY_MIGRATION_ROWS } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { targetArtifactValidator } from "@repo/backend/convex/tryouts/migration/artifacts";
import { hasPlacementArtifactContracts } from "@repo/backend/convex/tryouts/migration/rows";
import type { mapEntryValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Array as EffectArray } from "effect";

type MapEntry = Infer<typeof mapEntryValidator>;
type TargetArtifact = Infer<typeof targetArtifactValidator>;
type PlacementRow = Extract<
  ContentSnapshotRow,
  { readonly family: "tryout"; readonly rowKind: "placement" }
>;

const targetArtifactBatchReference = makeFunctionReference<
  "query",
  { migrationId: string; oldHashes: string[] },
  TargetArtifact[]
>("tryouts/migration/artifacts:targetArtifactBatch");

const TARGET_ARTIFACT_BATCH_SIZE = MAX_TRYOUT_HISTORY_MIGRATION_ROWS * 2;

/** Reads a complete artifact closure through the bounded Convex query seam. */
export const loadTargetArtifacts = Effect.fn(
  "tryouts.migration.loadTargetArtifacts"
)(function* <E, R>(
  mappings: readonly MapEntry[],
  readBatch: (
    oldHashes: readonly string[]
  ) => Effect.Effect<readonly TargetArtifact[], E, R>
) {
  const batches = yield* Effect.forEach(
    EffectArray.chunksOf(mappings, TARGET_ARTIFACT_BATCH_SIZE),
    (batch) => readBatch(batch.map(({ oldHash }) => oldHash)),
    { concurrency: 1 }
  );
  return EffectArray.flatten(batches);
});

/** Reauthenticates every mapped artifact and its placement-owned role. */
export const verifyTargetArtifactClosure = Effect.fn(
  "tryouts.migration.verifyTargetArtifactClosure"
)(function* (
  ctx: Pick<ActionCtx, "runQuery">,
  migrationId: string,
  entries: readonly MapEntry[],
  placements: readonly PlacementRow[],
  rendererManifest: RendererManifestEnvelope
) {
  const mappings = entries.filter(({ kind }) => kind === "artifact");
  const stored = yield* loadTargetArtifacts(mappings, (oldHashes) =>
    callInternal(() =>
      ctx.runQuery(targetArtifactBatchReference, {
        migrationId,
        oldHashes: [...oldHashes],
      })
    )
  );
  if (
    stored.length !== mappings.length ||
    stored.some(({ oldHash }, index) => oldHash !== mappings[index]?.oldHash)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted try-out artifacts are not a complete mapped target."
    );
  }
  const artifacts = new Map<string, SignedContentArtifact>();
  for (const [index, storedArtifact] of stored.entries()) {
    const mapping = mappings[index];
    if (!mapping) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted try-out artifact mapping lost its target."
      );
    }
    const artifact = yield* decodeArtifactJson(
      storedArtifact.artifactJson
    ).pipe(
      Effect.flatMap((decoded) =>
        verifySignedContentArtifact({
          artifact: decoded,
          rendererContractVersion: rendererManifest.rendererContractVersion,
          rendererManifest,
        })
      ),
      Effect.mapError(contractFailure)
    );
    if (
      mapping.identity !== mapping.oldHash ||
      mapping.newHash !== artifact.artifactHash ||
      storedArtifact.artifactHash !== artifact.artifactHash ||
      artifacts.has(artifact.artifactHash)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted try-out artifact changed its signed mapping identity."
      );
    }
    artifacts.set(artifact.artifactHash, artifact);
  }
  const referenced = new Set(
    placements.flatMap(({ record }) => [
      record.row.questionArtifactHash,
      record.row.answerArtifactHash,
    ])
  );
  if (
    referenced.size !== artifacts.size ||
    [...referenced].some((hash) => !artifacts.has(hash)) ||
    placements.some(
      ({ record }) =>
        !hasPlacementArtifactContracts(
          record.row,
          artifacts.get(record.row.questionArtifactHash),
          artifacts.get(record.row.answerArtifactHash)
        )
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted try-out artifacts do not close over their placement roles."
    );
  }
});
