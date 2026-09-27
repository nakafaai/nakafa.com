import { DatabaseReader, DatabaseWriter } from "@confect/server";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ensureDocumentSize,
  SEARCH_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type SearchProjection = Extract<
  ContentProjection,
  {
    readonly kind: "article" | "subject-lesson";
  }
>;

/** Builds deterministic searchable text from authenticated public source data. */
function searchableText(projection: SearchProjection, plainText: string) {
  return [
    projection.metadata.title,
    projection.metadata.description ?? "",
    projection.publicPath,
    plainText,
  ].join("\n");
}

/** Loads the sole active search row for one locale-specific content identity. */
const loadSearchEntry = Effect.fn("contentRelease.loadSearchEntry")(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  contentKey: string,
  appLocale: Doc<"contentIndex">["appLocale"]
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  return yield* database
    .table("contentIndex")
    .get("by_slot_and_contentKey_and_appLocale", slot, contentKey, appLocale)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Replaces one active public search row after its release becomes active. */
export const writeSearchEntry = Effect.fn("contentRelease.writeSearchEntry")(
  function* (
    ctx: MutationCtx,
    slot: ModelSlot,
    head: Pick<
      Doc<"contentHeads">,
      | "operation"
      | "delivery"
      | "projectionHash"
      | "contentKey"
      | "artifactLocale"
      | "family"
      | "releaseId"
      | "sequence"
    >,
    projection: ContentProjection,
    plainText: string
  ) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    if (
      head.operation !== "upsert" ||
      head.delivery !== "public" ||
      (projection.kind !== "article" && projection.kind !== "subject-lesson") ||
      !head.projectionHash ||
      projection.contentKey !== head.contentKey ||
      projection.artifactLocale !== head.artifactLocale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search entry ${head.contentKey}/${head.artifactLocale} lost its public identity.`
      );
    }
    const family = projection.kind === "article" ? "article" : "material";
    if (family !== head.family) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search entry ${head.contentKey}/${head.artifactLocale} changed family.`
      );
    }
    const entry: WithoutSystemFields<Doc<"contentIndex">> = {
      contentKey: head.contentKey,
      family,
      appLocale: projection.appLocale,
      projectionHash: head.projectionHash,
      publicPath: projection.publicPath,
      releaseId: head.releaseId,
      sequence: head.sequence,
      slot,
      text: searchableText(projection, plainText),
    };
    yield* ensureDocumentSize(
      "Active content search entry",
      entry,
      SEARCH_DOCUMENT_LIMIT
    );
    const existing = yield* loadSearchEntry(
      ctx,
      slot,
      head.contentKey,
      projection.appLocale
    );
    if (existing) {
      yield* writer
        .table("contentIndex")
        .replace(existing._id, entry)
        .pipe(Effect.orDie);
      return;
    }
    yield* writer.table("contentIndex").insert(entry).pipe(Effect.orDie);
  }
);

/** Removes one active search row after deletion or access-policy change. */
export const deleteSearchEntry = Effect.fn("contentRelease.deleteSearchEntry")(
  function* (
    ctx: MutationCtx,
    slot: ModelSlot,
    contentKey: string,
    appLocale: Doc<"contentIndex">["appLocale"]
  ) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const existing = yield* loadSearchEntry(ctx, slot, contentKey, appLocale);
    if (existing) {
      yield* writer.table("contentIndex").delete(existing._id);
    }
  }
);
