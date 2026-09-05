import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import type { ActiveContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/input";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { Effect, Option } from "effect";

/** Reads one exact active material through its authenticated catalog row. */
export const readMaterialReference = Effect.fn(
  "contentRelease.readMaterialReference"
)(function* (input: ActiveContentReferenceInput) {
  const owner = yield* loadMaterialOwner(input.appLocale);
  if (!(owner.active && owner.managed && owner.slot)) {
    return null;
  }
  const rows = yield* readMaterialRows(owner.slot, input);
  if (rows.length > 1) {
    return yield* identityCollision("material");
  }
  const candidate = rows[0];
  if (!candidate) {
    return null;
  }
  const { kind, row } = candidate;
  const { projection, resolved } = yield* verifyEffectiveMaterial(
    row,
    owner.active.sequence
  );
  if (kind === "topic") {
    const topic = yield* deriveMaterialTopicReference(projection);
    if (row.topicAssetId !== topic.graph.assetId) {
      return yield* identityCollision("material topic");
    }
    return buildContentSearchDocument({
      ...topic.graph,
      contentHash: resolved.projectionHash,
      hasMarkdownSource: false,
      locale: input.publicLocale,
      route: topic.publicPath,
      section: "material",
      sourcePath: topic.publicPath,
      syncedAt: resolved.sequence,
      text: topic.title,
      title: topic.title,
    });
  }
  return buildContentSearchDocument({
    ...projection.graph,
    contentHash: resolved.projectionHash,
    description: projection.metadata.description,
    hasMarkdownSource: true,
    locale: input.publicLocale,
    route: projection.publicPath,
    section: "material",
    sourcePath: projection.contentKey,
    syncedAt: resolved.sequence,
    text: projection.metadata.title,
    title: projection.metadata.title,
  });
});

/** Selects lesson and topic identities through their separate native indexes. */
const readMaterialRows = Effect.fn("contentRelease.readMaterialReferenceRows")(
  function* (slot: ModelSlot, input: ActiveContentReferenceInput) {
    const source = yield* MaterialSource;
    const rows = yield* Effect.all(
      input.kind === "route"
        ? {
            lessons: source.byPublicPath(
              slot,
              input.appLocale,
              input.publicPath
            ),
            topic: source.topicByPublicPath(
              slot,
              input.appLocale,
              input.publicPath
            ),
          }
        : {
            lessons: source.byAssetId(slot, input.appLocale, input.contentId),
            topic: source.topicByAssetId(
              slot,
              input.appLocale,
              input.contentId
            ),
          }
    );
    return [
      ...rows.lessons.map((row) => ({
        appLocale: input.appLocale,
        kind: "lesson" as const,
        row,
      })),
      ...Option.toArray(rows.topic).map((row) => ({
        appLocale: input.appLocale,
        kind: "topic" as const,
        row,
      })),
    ];
  }
);
/** Rejects a semantic identity shared by multiple current catalog rows. */
function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
