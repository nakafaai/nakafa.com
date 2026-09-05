import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { ArticleSource } from "@repo/backend/content/article/source";
import { verifyArticle } from "@repo/backend/content/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import type { ActiveContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { Effect } from "effect";

/** Reads one exact active article through its authenticated catalog row. */
export const readArticleReference = Effect.fn(
  "contentRelease.readArticleReference"
)(function* (input: ActiveContentReferenceInput) {
  const owner = yield* loadArticleOwner(input.appLocale);
  if (!(owner.active && owner.managed && owner.slot)) {
    return null;
  }
  const rows = yield* readArticleRows(owner.slot, input);
  if (rows.length > 1) {
    return yield* identityCollision("article");
  }
  const candidate = rows[0];
  if (!candidate) {
    return null;
  }
  const { row } = candidate;
  const verified = yield* verifyArticle(row, owner.active.sequence);
  const { projection, resolved } = verified;
  return buildContentSearchDocument({
    ...projection.graph,
    contentHash: resolved.projectionHash,
    description: projection.metadata.description,
    hasMarkdownSource: true,
    locale: input.publicLocale,
    route: projection.publicPath,
    section: "articles",
    sourcePath: projection.contentKey,
    syncedAt: resolved.sequence,
    text: projection.metadata.title,
    title: projection.metadata.title,
  });
});

/** Selects bounded article candidates through the canonical source. */
const readArticleRows = Effect.fn("contentRelease.readArticleReferenceRows")(
  function* (slot: ModelSlot, input: ActiveContentReferenceInput) {
    const source = yield* ArticleSource;
    const rows = yield* input.kind === "route"
      ? source.byPublicPath(slot, input.appLocale, input.publicPath)
      : source.byAssetId(slot, input.appLocale, input.contentId);
    return rows.map((row) => ({ appLocale: input.appLocale, row }));
  }
);
/** Rejects a semantic identity shared by multiple current catalog rows. */
function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
