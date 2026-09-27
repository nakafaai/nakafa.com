import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import type { ContentHead } from "@nakafa/aksara-contracts/release/head";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadExactVersion } from "@repo/backend/confect/contentRelease/model";
import { Effect, Option, Schema } from "effect";

/** Rejects a delete whose content identity still owns a visible route. */
const checkDeletedRoute = Effect.fn("contentRelease.checkDeletedRoute")(
  function* (row: Docs["contentItems"], head: ContentHead) {
    if (head.family === "question") {
      return;
    }
    const database = yield* DatabaseReader;
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
  row: Docs["contentItems"],
  change: Extract<
    ContentReleaseItem["change"],
    {
      operation: "delete";
    }
  >,
  head: ContentHead
) {
  const writer = yield* DatabaseWriter;
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
  yield* checkDeletedRoute(row, head);
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
