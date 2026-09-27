import { DatabaseReader, DatabaseWriter } from "@confect/server";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadExactVersion } from "@repo/backend/confect/contentRelease/model";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Option, Schema } from "effect";

/** Rejects a delete whose content identity still owns a visible route. */
const checkDeletedRoute = Effect.fn("contentRelease.checkDeletedRoute")(
  function* (ctx: MutationCtx, row: Doc<"contentItems">, head: ContentHead) {
    if (head.family === "question") {
      return;
    }
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const publicPath = yield* Effect.fromNullishOr(head.publicPath).pipe(
      Effect.orDie
    );
    const appLocale = yield* Schema.decodeEffect(AppLocaleSchema)(
      head.artifactLocale
    ).pipe(Effect.orDie);
    const owner = yield* database
      .table("contentBindings")
      .index(
        "by_appLocale_and_publicPath_and_sequence_and_index",
        (query) =>
          query
            .eq("appLocale", appLocale)
            .eq("publicPath", publicPath)
            .lte("sequence", row.sequence),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    if (
      !owner ||
      owner.operation === "delete" ||
      owner.contentKey !== row.contentKey
    ) {
      return;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Deleted content ${row.contentKey}/${row.artifactLocale} still owns a route.`
    );
  }
);

/** Inserts one immutable delete version or validates its idempotent retry. */
export const writeDelete = Effect.fn("contentRelease.writeDelete")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">,
  change: Extract<ContentReleaseItem["change"], { operation: "delete" }>,
  head: ContentHead
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (
    change.contentKey !== row.contentKey ||
    change.artifactLocale !== row.artifactLocale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Delete ${row.releaseId}/${row.index} lost its signed identity.`
    );
  }
  const existing = yield* loadExactVersion(
    ctx,
    row.contentKey,
    row.artifactLocale,
    row.sequence
  );
  if (existing) {
    if (
      existing.operation !== "delete" ||
      existing.releaseId !== row.releaseId ||
      existing.index !== row.index ||
      existing.family !== change.family
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content version ${row.contentKey}/${row.artifactLocale}/${row.sequence} conflicts.`
      );
    }
    return;
  }
  yield* checkDeletedRoute(ctx, row, head);
  yield* writer
    .table("contentHeads")
    .insert({
      contentKey: row.contentKey,
      family: change.family,
      index: row.index,
      artifactLocale: row.artifactLocale,
      operation: "delete",
      releaseId: row.releaseId,
      sequence: row.sequence,
    })
    .pipe(Effect.orDie);
});
