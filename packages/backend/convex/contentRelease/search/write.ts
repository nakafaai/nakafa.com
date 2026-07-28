import {
  type ContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ensureDocumentSize,
  SEARCH_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type PublicProjection = Exclude<
  ContentProjection,
  { readonly kind: "question-body" }
>;

/** Builds deterministic searchable text from authenticated public source data. */
function searchableText(projection: PublicProjection, plainText: string) {
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
  contentKey: string,
  locale: Doc<"contentIndex">["locale"]
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("contentIndex")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", contentKey).eq("locale", locale)
      )
      .unique()
  );
});

/** Replaces one active public search row after its release becomes active. */
export const writeSearchEntry = Effect.fn("contentRelease.writeSearchEntry")(
  function* (
    ctx: MutationCtx,
    head: WithoutSystemFields<Doc<"contentHeads">>,
    projection: ContentProjection,
    plainText: string
  ) {
    if (
      head.operation !== "upsert" ||
      head.delivery !== "public" ||
      projection.kind === "question-body" ||
      !head.projectionHash ||
      familyForProjection(projection) !== head.family ||
      projection.contentKey !== head.contentKey ||
      projection.locale !== head.locale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search entry ${head.contentKey}/${head.locale} lost its public identity.`
      );
    }
    const entry = {
      contentKey: head.contentKey,
      family: head.family,
      locale: head.locale,
      projectionHash: head.projectionHash,
      publicPath: projection.publicPath,
      releaseId: head.releaseId,
      sequence: head.sequence,
      text: searchableText(projection, plainText),
    };
    yield* ensureDocumentSize(
      "Active content search entry",
      entry,
      SEARCH_DOCUMENT_LIMIT
    );
    const existing = yield* loadSearchEntry(ctx, head.contentKey, head.locale);
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
    contentKey: string,
    locale: Doc<"contentIndex">["locale"]
  ) {
    const existing = yield* loadSearchEntry(ctx, contentKey, locale);
    if (existing) {
      yield* Effect.promise(() => ctx.db.delete("contentIndex", existing._id));
    }
  }
);
