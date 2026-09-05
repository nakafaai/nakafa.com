import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import { canonicalizeContentHead } from "@nakafa/aksara-contracts/release/head";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { contentHead } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadVersion } from "@repo/backend/convex/contentRelease/model";
import {
  decodeItemJson,
  decodeRollbackJson,
} from "@repo/backend/convex/contentRelease/parse";
import { writeDelete } from "@repo/backend/convex/contentRelease/verify/delete";
import { writeUpsert } from "@repo/backend/convex/contentRelease/verify/upsert";
import { Effect } from "effect";

/** Confirms stored prior evidence matches the immutable base snapshot. */
const checkRollback = Effect.fn("contentRelease.checkRollback")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">,
  item: ContentReleaseItem
) {
  const snapshot = yield* decodeRollbackJson(row.rollbackJson);
  if (snapshot.index !== row.index || snapshot.releaseId !== row.releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback evidence ${row.releaseId}/${row.index} lost its identity.`
    );
  }
  const prior =
    row.priorSequence === undefined
      ? null
      : yield* loadVersion(
          ctx,
          row.contentKey,
          row.artifactLocale,
          row.priorSequence
        );
  if (!prior || prior.operation === "delete") {
    if (
      snapshot.snapshot.state !== "absent" ||
      snapshot.snapshot.contentKey !== row.contentKey ||
      snapshot.snapshot.family !== item.change.family ||
      snapshot.snapshot.artifactLocale !== row.artifactLocale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Rollback evidence ${row.releaseId}/${row.index} contradicts absence.`
      );
    }
    return;
  }
  const sequence = yield* Effect.fromNullishOr(row.priorSequence).pipe(
    Effect.orDie
  );
  const head = yield* contentHead(prior, sequence).pipe(
    Effect.provide(convexPublicationLayer(ctx))
  );
  if (
    snapshot.snapshot.state !== head.family ||
    head.family !== item.change.family ||
    canonicalizeContentHead(head) !==
      canonicalizeContentHead(snapshot.snapshot.head)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Rollback evidence ${row.releaseId}/${row.index} differs from its base.`
    );
  }
});

/** Verifies one staged item and writes its immutable sequence version. */
export const checkItem = Effect.fn("contentRelease.checkItem")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">,
  releaseRole: Doc<"contentReleases">["role"]
) {
  const item = yield* decodeItemJson(row.itemJson);
  yield* checkRollback(ctx, row, item);
  if (item.change.operation === "delete") {
    if (row.artifactReady || row.projectionReady || row.projectionJson) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Delete item ${row.releaseId}/${row.index} contains bodies.`
      );
    }
    return yield* writeDelete(ctx, row);
  }
  return yield* writeUpsert(ctx, row, releaseRole);
});
