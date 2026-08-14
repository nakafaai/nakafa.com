import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { authenticateQuranSearchHit } from "@repo/backend/convex/contentRelease/quran/verify";
import {
  type ContentReferenceCandidate,
  selectContentReferenceCandidate,
} from "@repo/backend/convex/contentRelease/reference/candidates";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import type { ContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/groups";
import { Effect } from "effect";

/** Resolves one current semantic identity through exact signed family indexes. */
export const readContentReference = Effect.fn(
  "contentRelease.readContentReference"
)(function* (ctx: QueryCtx, input: ContentReferenceInput) {
  const candidate = yield* selectContentReferenceCandidate(ctx, input);
  if (!candidate) {
    return null;
  }
  const document = yield* verifyCandidate(ctx, candidate);
  return document ? toContentReference(document) : null;
});

/** Authenticates only the one family selected by exact indexed facts. */
const verifyCandidate = Effect.fn("contentRelease.verifyReferenceCandidate")(
  function* (ctx: QueryCtx, candidate: ContentReferenceCandidate) {
    switch (candidate.family) {
      case "article":
        return yield* readArticleReference(ctx, candidate.row);
      case "material":
        return yield* readMaterialReference(ctx, candidate.row);
      case "materialTopic":
        return yield* readMaterialTopicReference(ctx, candidate.row);
      case "quran":
        return yield* readQuranReference(
          ctx,
          candidate.snapshotId,
          candidate.row
        );
      case "tryout":
        return yield* readTryoutReference(candidate.snapshotId, candidate.row);
      default:
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Current content reference selected an unknown family."
        );
    }
  }
);

/** Authenticates one active article and projects its public reference. */
const readArticleReference = Effect.fn("contentRelease.readArticleReference")(
  function* (
    ctx: QueryCtx,
    row: Extract<
      ContentReferenceCandidate,
      { readonly family: "article" }
    >["row"]
  ) {
    const owner = yield* loadArticleOwner(ctx, row.locale);
    if (!(owner.active && owner.managed)) {
      return null;
    }
    const { projection, resolved } = yield* verifyArticle(
      ctx,
      row,
      owner.active.sequence
    );
    return buildContentSearchDocument({
      ...projection.graph,
      contentHash: resolved.projectionHash,
      description: projection.metadata.description,
      locale: projection.locale,
      route: projection.publicPath,
      section: "articles",
      sourcePath: projection.contentKey,
      syncedAt: resolved.sequence,
      text: projection.metadata.title,
      title: projection.metadata.title,
    });
  }
);

/** Authenticates one active material lesson and its publication owner. */
const readMaterialReference = Effect.fn("contentRelease.readMaterialReference")(
  function* (
    ctx: QueryCtx,
    row: Extract<
      ContentReferenceCandidate,
      { readonly family: "material" }
    >["row"]
  ) {
    const verified = yield* verifyReferenceMaterial(ctx, row);
    if (!verified) {
      return null;
    }
    const { projection, resolved } = verified;
    return buildContentSearchDocument({
      ...projection.graph,
      contentHash: resolved.projectionHash,
      description: projection.metadata.description,
      locale: projection.locale,
      route: projection.publicPath,
      section: "material",
      sourcePath: projection.contentKey,
      syncedAt: resolved.sequence,
      text: projection.metadata.title,
      title: projection.metadata.title,
    });
  }
);

/** Authenticates one material topic through its indexed lesson representative. */
const readMaterialTopicReference = Effect.fn(
  "contentRelease.readMaterialTopicReference"
)(function* (
  ctx: QueryCtx,
  row: Extract<
    ContentReferenceCandidate,
    { readonly family: "materialTopic" }
  >["row"]
) {
  const verified = yield* verifyReferenceMaterial(ctx, row);
  if (!verified) {
    return null;
  }
  const { projection, resolved } = verified;
  const topic = yield* deriveMaterialTopicReference(projection);
  if (row.topicAssetId !== topic.graph.assetId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material topic ${topic.graph.assetId} lost its indexed identity.`
    );
  }
  return buildContentSearchDocument({
    ...topic.graph,
    contentHash: resolved.projectionHash,
    locale: topic.locale,
    route: topic.publicPath,
    section: "material",
    sourcePath: topic.publicPath,
    syncedAt: resolved.sequence,
    text: topic.title,
    title: topic.title,
  });
});

/** Authenticates one Quran search projection and its immutable signed row. */
const readQuranReference = Effect.fn("contentRelease.readQuranReference")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    row: Extract<ContentReferenceCandidate, { readonly family: "quran" }>["row"]
  ) {
    const signed = yield* authenticateQuranSearchHit(ctx, snapshotId, row);
    return buildContentSearchDocument({
      ...signed.payload.graph,
      contentHash: signed.rowHash,
      locale: signed.payload.locale,
      route: signed.payload.route,
      section: "quran",
      sourcePath: signed.payload.route,
      syncedAt: signed.index,
      text: signed.payload.text,
      title: signed.payload.title,
    });
  }
);

/** Authenticates one exact public try-out catalog row. */
const readTryoutReference = Effect.fn("contentRelease.readTryoutReference")(
  function* (
    snapshotId: string,
    stored: Extract<
      ContentReferenceCandidate,
      { readonly family: "tryout" }
    >["row"]
  ) {
    const row = yield* verifyTryoutCatalog(stored, snapshotId);
    if (!row.publicPath) {
      return null;
    }
    return buildContentSearchDocument({
      ...row.graph,
      contentHash: stored.rowHash,
      description: row.description,
      locale: row.locale,
      route: row.publicPath,
      section: "tryout",
      sourcePath: row.publicPath,
      syncedAt: stored.index,
      text: "",
      title: row.title,
    });
  }
);

/** Authenticates the selected material row at the active publication sequence. */
const verifyReferenceMaterial = Effect.fn(
  "contentRelease.verifyReferenceMaterial"
)(function* (
  ctx: QueryCtx,
  row: Extract<
    ContentReferenceCandidate,
    { readonly family: "material" | "materialTopic" }
  >["row"]
) {
  const owner = yield* loadMaterialOwner(ctx, row.locale);
  if (!(owner.active && owner.managed)) {
    return null;
  }
  return yield* verifyEffectiveMaterial(ctx, row, owner.active.sequence);
});

/** Narrows the internal search document to the public reference contract. */
function toContentReference(match: ContentSearchDocument) {
  return {
    alignmentId: match.alignmentId,
    assetId: match.assetId,
    conceptId: match.conceptId,
    content_id: match.content_id,
    description: match.description,
    learningObjectId: match.learningObjectId,
    lensId: match.lensId,
    locale: match.locale,
    markdown_url: match.markdown_url,
    route: match.route,
    section: match.section,
    title: match.title,
    url: match.url,
  };
}
