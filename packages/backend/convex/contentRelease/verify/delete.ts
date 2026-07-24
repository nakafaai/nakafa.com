import { isQuestionProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadExactVersion,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeItemJson,
  decodeProjectionJson,
} from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Rejects a delete whose content identity still owns a visible route. */
const checkDeletedRoute = Effect.fn("contentRelease.checkDeletedRoute")(
  function* (ctx: MutationCtx, row: Doc<"contentItems">) {
    if (row.priorSequence === undefined) {
      return;
    }
    const prior = yield* loadVersion(
      ctx,
      row.contentKey,
      row.locale,
      row.priorSequence
    );
    if (!prior?.projectionJson || prior.operation === "delete") {
      return;
    }
    const projection = yield* decodeProjectionJson(prior.projectionJson);
    if (isQuestionProjection(projection)) {
      return;
    }
    const owner = yield* Effect.promise(() =>
      ctx.db
        .query("contentBindings")
        .withIndex("by_locale_and_publicPath_and_sequence_and_index", (query) =>
          query
            .eq("locale", row.locale)
            .eq("publicPath", projection.publicPath)
            .lte("sequence", row.sequence)
        )
        .order("desc")
        .first()
    );
    if (
      !owner ||
      owner.operation === "delete" ||
      owner.contentKey !== row.contentKey
    ) {
      return;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Deleted content ${row.contentKey}/${row.locale} still owns a route.`
    );
  }
);

/** Inserts one immutable delete version or validates its idempotent retry. */
export const writeDelete = Effect.fn("contentRelease.writeDelete")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">
) {
  const item = yield* decodeItemJson(row.itemJson);
  if (
    item.change.operation !== "delete" ||
    item.change.contentKey !== row.contentKey ||
    item.change.locale !== row.locale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Delete ${row.releaseId}/${row.index} lost its signed identity.`
    );
  }
  const existing = yield* loadExactVersion(
    ctx,
    row.contentKey,
    row.locale,
    row.sequence
  );
  if (existing) {
    if (
      existing.operation !== "delete" ||
      existing.releaseId !== row.releaseId ||
      existing.index !== row.index ||
      existing.family !== item.change.family
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content version ${row.contentKey}/${row.locale}/${row.sequence} conflicts.`
      );
    }
    return;
  }
  yield* checkDeletedRoute(ctx, row);
  yield* Effect.promise(() =>
    ctx.db.insert("contentHeads", {
      contentKey: row.contentKey,
      family: item.change.family,
      index: row.index,
      locale: row.locale,
      operation: "delete",
      releaseId: row.releaseId,
      sequence: row.sequence,
    })
  );
});
