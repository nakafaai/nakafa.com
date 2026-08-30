import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ensureDocumentSize,
  SEARCH_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type SearchProjection = Extract<
  ContentProjection,
  { readonly kind: "article" | "subject-lesson" }
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
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentIndex")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index
          .eq("slot", slot)
          .eq("contentKey", contentKey)
          .eq("appLocale", appLocale)
      )
      .unique()
  );
});

/** Replaces one active public search row after its release becomes active. */
export const writeSearchEntry = Effect.fn("contentRelease.writeSearchEntry")(
  function* (
    ctx: MutationCtx,
    slot: ModelSlot,
    head: WithoutSystemFields<Doc<"contentHeads">>,
    projection: ContentProjection,
    plainText: string
  ) {
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
      yield* Effect.promise(() =>
        ctx.db.replace("contentIndex", existing._id, entry)
      );
      return;
    }
    yield* Effect.promise(() => ctx.db.insert("contentIndex", entry));
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
    const existing = yield* loadSearchEntry(ctx, slot, contentKey, appLocale);
    if (existing) {
      yield* Effect.promise(() => ctx.db.delete("contentIndex", existing._id));
    }
  }
);
