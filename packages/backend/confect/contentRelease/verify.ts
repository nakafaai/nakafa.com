import { snapshotRowCount } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/confect/contentRelease/proof/budget";
import {
  PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { checkItem } from "@repo/backend/confect/contentRelease/verify/item";
import { Clock, Effect } from "effect";

/** Freezes a complete staged release before any cross-transaction proof read. */
export const beginVerification = Effect.fn("contentRelease.beginVerification")(
  function* (releaseId: string) {
    const writer = yield* DatabaseWriter;
    const { release } = yield* loadStaged(releaseId);
    if (release.status === "verifying" || release.status === "verified") {
      return release.checkedIndex;
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const complete =
      release.status === "staging" &&
      release.abortingAt === undefined &&
      release.stagedItems === signed.manifest.itemCount &&
      release.stagedDeletes === signed.manifest.deleteCount &&
      release.stagedUpserts === signed.manifest.upsertCount &&
      release.stagedArtifacts === signed.manifest.upsertCount &&
      release.stagedProjections === signed.manifest.projectionCount &&
      release.stagedRoutes === signed.manifest.routeCount &&
      release.stagedSnapshotRows ===
        snapshotRowCount(signed.manifest.snapshots);
    if (!complete) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} is not completely staged for verification.`
      );
    }
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        status: "verifying",
        updatedAt: yield* Clock.currentTimeMillis,
      })
      .pipe(Effect.orDie);
    return release.checkedIndex;
  }
);

/** Verifies one resumable contiguous page before proof can be committed. */
export const verifyProgram = Effect.fn("contentRelease.verifyItems")(function* (
  releaseId: string,
  afterIndex: number
) {
  const ctx = yield* MutationCtxService;
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const { release } = yield* loadStaged(releaseId);
  if (release.status === "verified") {
    return {
      done: true,
      nextIndex: release.checkedIndex,
      processed: 0,
    };
  }
  if (
    release.abortingAt !== undefined ||
    release.status !== "verifying" ||
    !Number.isSafeInteger(afterIndex) ||
    afterIndex < -1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} cannot verify from its current state.`
    );
  }
  if (afterIndex !== release.checkedIndex) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} expected verification cursor ${release.checkedIndex}.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const rows = yield* database
    .table("contentItems")
    .index("by_releaseId_and_index", (query) =>
      query.eq("releaseId", releaseId).gt("index", afterIndex)
    )
    .paginate({
      cursor: null,
      maximumBytesRead: PROOF_PAGE_BYTES,
      maximumRowsRead: PROOF_PAGE_LIMIT,
      numItems: PROOF_PAGE_LIMIT,
    })
    .pipe(Effect.orDie);
  let processed = 0;
  let nextIndex = release.checkedIndex;
  for (const row of rows.page) {
    const offset = processed;
    const expectedIndex = release.checkedItems + offset;
    if (row.index !== expectedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} expected item ${expectedIndex}, received ${row.index}.`
      );
    }
    yield* checkItem(row);
    processed += 1;
    nextIndex = row.index;
    const metrics = yield* Effect.promise(() =>
      ctx.meta.getTransactionMetrics()
    );
    if (!hasProofTransactionHeadroom(metrics)) {
      break;
    }
  }
  const checkedItems = release.checkedItems + processed;
  const done = rows.isDone && processed === rows.page.length;
  if (done && checkedItems !== signed.manifest.itemCount) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${releaseId} verified ${checkedItems} of ${signed.manifest.itemCount} items.`
    );
  }
  yield* writer
    .table("contentReleases")
    .patch(release._id, {
      checkedIndex: nextIndex,
      checkedItems,
      status: "verifying",
      updatedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
  return {
    done,
    nextIndex,
    processed,
  };
});
