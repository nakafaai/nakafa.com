import {
  classifyLearningGraphAssetId,
  type LearningGraphFamily,
} from "@nakafa/aksara-contracts/graph/family";
import {
  type ActiveAppLocale,
  ActiveAppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { materialPublicNamespace } from "@nakafa/aksara-contracts/projection/material";
import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import { findTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import type { ContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/groups";
import { authenticateQuranSearchHit } from "@repo/backend/convex/contents/helpers/search/quran/authenticate";
import { Effect, Option, Schema } from "effect";

type ActiveContentReferenceInput = (
  | Extract<ContentReferenceInput, { readonly kind: "content" }>
  | Extract<ContentReferenceInput, { readonly kind: "route" }>
) & {
  readonly appLocale: ActiveAppLocale;
  readonly family: LearningGraphFamily;
};

/** Classifies one current public route through its locale-owned namespace. */
function classifyPublicRoute(
  appLocale: ActiveAppLocale,
  publicPath: string
): LearningGraphFamily | null {
  const [namespace] = publicPath.split("/");
  if (namespace === "articles") {
    return "article";
  }
  if (namespace === materialPublicNamespace(appLocale)) {
    return "material";
  }
  if (namespace === "quran") {
    return "quran";
  }
  if (namespace === "try-out") {
    return "tryout";
  }
  return null;
}

/** Selects one exact current family before reading any signed row. */
const resolveReferenceInput = Effect.fn("contentRelease.resolveReferenceInput")(
  function* (input: ContentReferenceInput) {
    if (input.kind === "content") {
      const owner = yield* Effect.option(
        classifyLearningGraphAssetId(input.contentId)
      );
      if (Option.isNone(owner)) {
        return null;
      }
      const appLocale = Schema.decodeUnknownOption(ActiveAppLocaleSchema)(
        owner.value.appLocale
      );
      if (Option.isNone(appLocale)) {
        return null;
      }
      return {
        ...input,
        appLocale: appLocale.value,
        family: owner.value.family,
      };
    }
    const appLocale = Schema.decodeUnknownOption(ActiveAppLocaleSchema)(
      input.appLocale
    );
    if (Option.isNone(appLocale)) {
      return null;
    }
    const family = classifyPublicRoute(appLocale.value, input.publicPath);
    if (family === null) {
      return null;
    }
    return { ...input, appLocale: appLocale.value, family };
  }
);

/** Resolves one current semantic identity across every active signed family. */
export const readContentReference = Effect.fn(
  "contentRelease.readContentReference"
)(function* (ctx: QueryCtx, input: ContentReferenceInput) {
  const activeInput = yield* resolveReferenceInput(input);
  if (!activeInput) {
    return null;
  }
  let match: ContentSearchDocument | null;
  if (activeInput.family === "article") {
    match = yield* readArticleReference(ctx, activeInput);
  } else if (activeInput.family === "material") {
    match = yield* readMaterialReference(ctx, activeInput);
  } else if (activeInput.family === "quran") {
    match = yield* readQuranReference(ctx, activeInput);
  } else {
    match = yield* readTryoutReference(ctx, activeInput);
  }
  if (!match) {
    return null;
  }
  return {
    alignmentId: match.alignmentId,
    assetId: match.assetId,
    conceptId: match.conceptId,
    content_id: match.content_id,
    description: match.description,
    learningObjectId: match.learningObjectId,
    lensId: match.lensId,
    locale: match.locale,
    ...(match.markdown_url === undefined
      ? {}
      : { markdown_url: match.markdown_url }),
    route: match.route,
    section: match.section,
    title: match.title,
    url: match.url,
  };
});

/** Reads one exact active article through its authenticated catalog row. */
const readArticleReference = Effect.fn("contentRelease.readArticleReference")(
  function* (ctx: QueryCtx, input: ActiveContentReferenceInput) {
    const rows = yield* readArticleRows(ctx, input);
    if (rows.length > 1) {
      return yield* identityCollision("article");
    }
    const candidate = rows[0];
    if (!candidate) {
      return null;
    }
    const { appLocale, row } = candidate;
    const owner = yield* loadArticleOwner(ctx, appLocale);
    if (!(owner.active && owner.managed)) {
      return null;
    }
    const verified = yield* verifyArticle(ctx, row, owner.active.sequence);
    const { projection, resolved } = verified;
    return buildContentSearchDocument({
      ...projection.graph,
      contentHash: resolved.projectionHash,
      description: projection.metadata.description,
      locale: appLocale,
      route: projection.publicPath,
      section: "articles",
      sourcePath: projection.contentKey,
      syncedAt: resolved.sequence,
      text: projection.metadata.title,
      title: projection.metadata.title,
    });
  }
);

/** Selects article candidates through locale-bound current indexes. */
function readArticleRows(ctx: QueryCtx, input: ActiveContentReferenceInput) {
  if (input.kind === "route") {
    return Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_appLocale_and_publicPath", (index) =>
          index
            .eq("appLocale", input.appLocale)
            .eq("publicPath", input.publicPath)
        )
        .take(2)
    ).pipe(
      Effect.map((rows) =>
        rows.map((row) => ({ appLocale: input.appLocale, row }))
      )
    );
  }
  return Effect.promise(() =>
    ctx.db
      .query("articleCatalog")
      .withIndex("by_appLocale_and_assetId", (index) =>
        index.eq("appLocale", input.appLocale).eq("assetId", input.contentId)
      )
      .take(2)
  ).pipe(
    Effect.map((rows) =>
      rows.map((row) => ({ appLocale: input.appLocale, row }))
    )
  );
}

/** Reads one exact active material through its authenticated catalog row. */
const readMaterialReference = Effect.fn("contentRelease.readMaterialReference")(
  function* (ctx: QueryCtx, input: ActiveContentReferenceInput) {
    const rows = yield* readMaterialRows(ctx, input);
    if (rows.length > 1) {
      return yield* identityCollision("material");
    }
    const candidate = rows[0];
    if (!candidate) {
      return null;
    }
    const { appLocale, kind, row } = candidate;
    const owner = yield* loadMaterialOwner(ctx, appLocale);
    if (!(owner.active && owner.managed)) {
      return null;
    }
    const { projection, resolved } = yield* verifyEffectiveMaterial(
      ctx,
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
        locale: appLocale,
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
      locale: appLocale,
      route: projection.publicPath,
      section: "material",
      sourcePath: projection.contentKey,
      syncedAt: resolved.sequence,
      text: projection.metadata.title,
      title: projection.metadata.title,
    });
  }
);

/** Selects material candidates through locale-bound current indexes. */
const readMaterialRows = Effect.fn("contentRelease.readMaterialReferenceRows")(
  function* (ctx: QueryCtx, input: ActiveContentReferenceInput) {
    if (input.kind === "route") {
      const rows = yield* Effect.all({
        lessons: Effect.promise(() =>
          ctx.db
            .query("materialCatalog")
            .withIndex("by_appLocale_and_publicPath", (index) =>
              index
                .eq("appLocale", input.appLocale)
                .eq("publicPath", input.publicPath)
            )
            .take(2)
        ),
        topic: Effect.promise(() =>
          ctx.db
            .query("materialCatalog")
            .withIndex(
              "by_appLocale_and_parentPath_and_order_and_publicPath",
              (index) =>
                index
                  .eq("appLocale", input.appLocale)
                  .eq("parentPath", input.publicPath)
            )
            .first()
        ),
      });
      return [
        ...rows.lessons.map((row) => ({
          appLocale: input.appLocale,
          kind: "lesson" as const,
          row,
        })),
        ...(rows.topic
          ? [
              {
                appLocale: input.appLocale,
                kind: "topic" as const,
                row: rows.topic,
              },
            ]
          : []),
      ];
    }
    const rows = yield* Effect.all({
      lessons: Effect.promise(() =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_appLocale_and_assetId", (index) =>
            index
              .eq("appLocale", input.appLocale)
              .eq("assetId", input.contentId)
          )
          .take(2)
      ),
      topic: Effect.promise(() =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_appLocale_and_topicAssetId_and_assetId", (index) =>
            index
              .eq("appLocale", input.appLocale)
              .eq("topicAssetId", input.contentId)
          )
          .first()
      ),
    });
    return [
      ...rows.lessons.map((row) => ({
        appLocale: input.appLocale,
        kind: "lesson" as const,
        row,
      })),
      ...(rows.topic
        ? [
            {
              appLocale: input.appLocale,
              kind: "topic" as const,
              row: rows.topic,
            },
          ]
        : []),
    ];
  }
);

/** Resolves one Quran route or graph asset through its active signed row. */
const readQuranReference = Effect.fn("contentRelease.readQuranReference")(
  function* (ctx: QueryCtx, input: ActiveContentReferenceInput) {
    const owner = yield* loadQuranOwner(ctx);
    if (owner.snapshotId === null) {
      return null;
    }
    const signed = yield* readQuranReferenceRow(ctx, owner.snapshotId, input);
    if (signed === null) {
      return null;
    }
    return buildContentSearchDocument({
      ...signed.payload.graph,
      contentHash: signed.rowHash,
      locale: input.appLocale,
      route: signed.payload.route,
      section: "quran",
      sourcePath: signed.payload.route,
      syncedAt: signed.index,
      text: signed.payload.text,
      title: signed.payload.title,
    });
  }
);

/** Reads one current Quran search row through its exact semantic index. */
const readQuranReferenceRow = Effect.fn("contentRelease.readQuranReferenceRow")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    input: ActiveContentReferenceInput
  ) {
    if (input.kind === "content") {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("quranSearch")
          .withIndex("by_snapshotId_and_appLocale_and_assetId", (index) =>
            index
              .eq("snapshotId", snapshotId)
              .eq("appLocale", input.appLocale)
              .eq("assetId", input.contentId)
          )
          .take(2)
      );
      if (rows.length > 1) {
        return yield* identityCollision("Quran");
      }
      const row = rows[0];
      if (!row) {
        return null;
      }
      return yield* authenticateQuranSearchHit(ctx, snapshotId, row);
    }
    const segments = input.publicPath.split("/");
    const surahNumber = Schema.decodeOption(QuranSurahNumberSchema)(
      Number(segments[1])
    );
    if (
      segments.length !== 2 ||
      Option.isNone(surahNumber) ||
      input.publicPath !== `quran/${surahNumber.value}`
    ) {
      return null;
    }
    return yield* readQuranRow(
      ctx,
      snapshotId,
      quranSearchIdentity(input.appLocale, surahNumber.value),
      QuranSearchRowSchema
    );
  }
);

/** Resolves one exact public try-out entry from its active signed hierarchy. */
const readTryoutReference = Effect.fn("contentRelease.readTryoutReference")(
  function* (ctx: QueryCtx, input: ActiveContentReferenceInput) {
    const owner = yield* findTryoutOwner(ctx);
    if (Option.isNone(owner)) {
      return null;
    }
    const { snapshotId } = owner.value;
    const rows = yield* readTryoutReferenceRows(ctx, snapshotId, input);
    if (rows.length > 1) {
      return yield* identityCollision("try-out");
    }
    const stored = rows[0];
    if (!stored) {
      return null;
    }
    const row = yield* verifyTryoutCatalog(stored, snapshotId);
    if (!row.publicPath) {
      return null;
    }
    return buildContentSearchDocument({
      ...row.graph,
      contentHash: stored.rowHash,
      description: row.description,
      locale: input.appLocale,
      route: row.publicPath,
      section: "tryout",
      sourcePath: row.publicPath,
      syncedAt: stored.index,
      text: "",
      title: row.title,
    });
  }
);

/** Selects try-out candidates through one exact current semantic index. */
function readTryoutReferenceRows(
  ctx: QueryCtx,
  snapshotId: string,
  input: ActiveContentReferenceInput
) {
  if (input.kind === "route") {
    return Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_appLocale_and_publicPath", (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("appLocale", input.appLocale)
            .eq("publicPath", input.publicPath)
        )
        .take(2)
    );
  }
  return Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_appLocale_and_assetId", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("appLocale", input.appLocale)
          .eq("assetId", input.contentId)
      )
      .take(2)
  );
}

/** Produces one typed exact-identity collision failure. */
function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
