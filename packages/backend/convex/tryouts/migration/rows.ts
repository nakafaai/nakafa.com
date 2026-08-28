"use node";

import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import type { StoredTryoutRow } from "@nakafa/aksara-contracts/history/decode";
import {
  hasLosslessHistoricalCatalogMapping,
  hasLosslessHistoricalPlacementMapping,
} from "@nakafa/aksara-contracts/migration/tryout/history/lossless";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { TryoutHistoryMigrationRequest } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { verifySnapshotBatch } from "@repo/backend/convex/contentRelease/ingress/snapshot";
import { decodeArtifactJson } from "@repo/backend/convex/contentRelease/parse";
import { encodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/wire";
import type { targetArtifactValidator } from "@repo/backend/convex/tryouts/migration/artifacts";
import { loadMigrationTargetRuntime } from "@repo/backend/convex/tryouts/migration/bundle";
import { loadMigrationRowBatch } from "@repo/backend/convex/tryouts/migration/read";
import type { simpleStageReceiptValidator } from "@repo/backend/convex/tryouts/migration/stage/schema";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type StageRowsRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "stageRows" }
>;
type StageReceipt = Infer<typeof simpleStageReceiptValidator>;
type TargetArtifact = Infer<typeof targetArtifactValidator>;

interface StagedRowEntry {
  readonly identity: string;
  readonly index: number;
  readonly kind: "catalog" | "placement";
  readonly newHash: string;
  readonly oldHash: string;
  readonly rowJson: string;
}

const targetArtifactBatchReference = makeFunctionReference<
  "query",
  {
    migrationId: string;
    oldHashes: string[];
  },
  TargetArtifact[]
>("tryouts/migration/artifacts:targetArtifactBatch");
const stageRowsReference = makeFunctionReference<
  "mutation",
  {
    entries: StagedRowEntry[];
    migrationId: string;
    targetSnapshotId: string;
  },
  StageReceipt
>("tryouts/migration/stage/row:stageRows");

/** Loads exact artifact mappings needed by converted placement rows. */
const loadArtifactMap = Effect.fn("tryouts.migration.loadArtifactMap")(
  function* (
    ctx: Pick<ActionCtx, "runQuery">,
    migrationId: string,
    oldHashes: readonly string[]
  ) {
    const uniqueHashes = [...new Set(oldHashes)];
    const stored = yield* callInternal(() =>
      ctx.runQuery(targetArtifactBatchReference, {
        migrationId,
        oldHashes: uniqueHashes,
      })
    );
    if (
      stored.length !== uniqueHashes.length ||
      stored.some(({ oldHash }, index) => oldHash !== uniqueHashes[index])
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted placement artifact mappings are incomplete."
      );
    }
    const artifacts = yield* Effect.forEach(stored, (entry) =>
      decodeArtifactJson(entry.artifactJson).pipe(
        Effect.flatMap((artifact) =>
          artifact.artifactHash === entry.artifactHash
            ? Effect.succeed({ artifact, oldHash: entry.oldHash })
            : releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                "Converted placement artifact changed its stored identity."
              )
        )
      )
    );
    const byOldHash = new Map<string, SignedContentArtifact>();
    for (const { artifact, oldHash } of artifacts) {
      byOldHash.set(oldHash, artifact);
    }
    return byOldHash;
  }
);

/** Checks one permanent artifact matches its exact placement-owned role. */
function hasArtifactRole(
  artifact: SignedContentArtifact | undefined,
  expected: {
    readonly artifactHash: string;
    readonly artifactLocale: string;
    readonly contentKey: string;
    readonly rendererDomain: string;
  }
) {
  return (
    artifact?.artifactHash === expected.artifactHash &&
    artifact.payload.artifactLocale === expected.artifactLocale &&
    artifact.payload.contentKey === expected.contentKey &&
    artifact.payload.rendererDomain === expected.rendererDomain
  );
}

/** Proves question and answer artifacts fulfill their placement-owned roles. */
export function hasPlacementArtifactContracts(
  target: TryoutPlacement,
  question: SignedContentArtifact | undefined,
  answer: SignedContentArtifact | undefined
) {
  return (
    hasArtifactRole(question, {
      artifactHash: target.questionArtifactHash,
      artifactLocale: target.questionArtifactLocale,
      contentKey: target.questionContentKey,
      rendererDomain: target.rendererDomain,
    }) &&
    hasArtifactRole(answer, {
      artifactHash: target.answerArtifactHash,
      artifactLocale: target.answerArtifactLocale,
      contentKey: target.answerContentKey,
      rendererDomain: target.rendererDomain,
    })
  );
}

/** Proves a placement targets the exact converted question and answer bytes. */
function hasMappedArtifacts(
  source: Extract<StoredTryoutRow, { readonly rowKind: "placement" }>,
  target: Extract<
    StageRowsRequest["mappings"][number],
    { readonly rowKind: "placement" }
  >,
  artifacts: ReadonlyMap<string, SignedContentArtifact>
) {
  const question = artifacts.get(source.record.row.questionArtifactHash);
  const answer = artifacts.get(source.record.row.answerArtifactHash);
  return hasPlacementArtifactContracts(target.record.row, question, answer);
}

/** Authenticates lossless row conversion before immutable target staging. */
export const stageMigrationRows = Effect.fn(
  "tryouts.migration.stageRowsIngress"
)(function* (
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  request: StageRowsRequest
) {
  const rowKind = request.mappings[0]?.rowKind;
  if (
    rowKind === undefined ||
    request.mappings.some((mapping) => mapping.rowKind !== rowKind)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history row staging cannot mix row kinds."
    );
  }
  const runtime = yield* loadMigrationTargetRuntime(ctx, request.releaseId);
  if (runtime.bundle.payload.snapshot.snapshotId !== request.targetSnapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history rows differ from their permanent bundle."
    );
  }
  const sources = yield* loadMigrationRowBatch(
    ctx,
    request.mappings.map(({ oldRowHash }) => oldRowHash),
    rowKind,
    request.sourceSnapshotId
  );
  const oldArtifactHashes = sources.flatMap(({ row }) =>
    row.rowKind === "placement"
      ? [row.record.row.questionArtifactHash, row.record.row.answerArtifactHash]
      : []
  );
  const artifacts = yield* loadArtifactMap(
    ctx,
    request.releaseId,
    oldArtifactHashes
  );
  const rows: ContentSnapshotRow[] = request.mappings.map((mapping) =>
    mapping.rowKind === "catalog"
      ? {
          family: "tryout",
          record: mapping.record,
          rowKind: mapping.rowKind,
        }
      : {
          family: "tryout",
          record: mapping.record,
          rowKind: mapping.rowKind,
        }
  );
  yield* verifySnapshotBatch("tryout", request.targetSnapshotId, rows);
  const entries = yield* Effect.forEach(request.mappings, (mapping, index) =>
    Effect.gen(function* () {
      const source = sources[index];
      if (
        !source ||
        source.index !== mapping.index ||
        source.row.rowKind !== mapping.rowKind ||
        source.row.record.rowHash !== mapping.oldRowHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history row conversion changed its source identity."
        );
      }
      if (mapping.rowKind === "catalog") {
        if (
          source.row.rowKind !== "catalog" ||
          !hasLosslessHistoricalCatalogMapping(
            source.row.record.row,
            mapping.record.row
          )
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Try-out history catalog conversion is not lossless."
          );
        }
        const row: ContentSnapshotRow = {
          family: "tryout",
          record: mapping.record,
          rowKind: mapping.rowKind,
        };
        return {
          identity: tryoutCatalogIdentity(mapping.record.row),
          index: mapping.index,
          kind: mapping.rowKind,
          newHash: mapping.record.rowHash,
          oldHash: mapping.oldRowHash,
          rowJson: encodeSnapshotRowJson(row),
        } satisfies StagedRowEntry;
      }
      if (
        source.row.rowKind !== "placement" ||
        !hasLosslessHistoricalPlacementMapping(
          source.row.record.row,
          mapping.record.row
        ) ||
        !hasMappedArtifacts(source.row, mapping, artifacts)
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history placement conversion is not lossless."
        );
      }
      const row: ContentSnapshotRow = {
        family: "tryout",
        record: mapping.record,
        rowKind: mapping.rowKind,
      };
      return {
        identity: tryoutPlacementIdentity(mapping.record.row),
        index: mapping.index,
        kind: mapping.rowKind,
        newHash: mapping.record.rowHash,
        oldHash: mapping.oldRowHash,
        rowJson: encodeSnapshotRowJson(row),
      } satisfies StagedRowEntry;
    })
  );
  const receipt = yield* callInternal(() =>
    ctx.runMutation(stageRowsReference, {
      entries,
      migrationId: request.releaseId,
      targetSnapshotId: request.targetSnapshotId,
    })
  );
  return {
    ...receipt,
    command: request.command,
    migrationId: request.releaseId,
  };
});
