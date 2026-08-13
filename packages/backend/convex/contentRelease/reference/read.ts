import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import { findTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import type { ContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/groups";
import { Effect, Option } from "effect";

const QURAN_SURAH_COUNT = 114;

/** Resolves one current semantic identity across every active signed family. */
export const readContentReference = Effect.fn(
  "contentRelease.readContentReference"
)(function* (ctx: QueryCtx, input: ContentReferenceInput) {
  const results = yield* Effect.all(
    {
      article: readArticleReference(ctx, input),
      material: readMaterialReference(ctx, input),
      quran: readQuranReference(ctx, input),
      tryout: readTryoutReference(ctx, input),
    },
    { concurrency: "unbounded" }
  );
  const matches = Object.values(results).filter(
    (result): result is ContentSearchDocument => result !== null
  );
  if (matches.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Current content identity resolves more than one signed family."
    );
  }
  const match = matches[0];
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
    markdown_url: match.markdown_url,
    route: match.route,
    section: match.section,
    title: match.title,
    url: match.url,
  };
});

/** Reads one exact active article through its authenticated catalog row. */
const readArticleReference = Effect.fn("contentRelease.readArticleReference")(
  function* (ctx: QueryCtx, input: ContentReferenceInput) {
    const rows = yield* readArticleRows(ctx, input);
    if (rows.length > 1) {
      return yield* identityCollision("article");
    }
    const row = rows[0];
    if (!row) {
      return null;
    }
    const owner = yield* loadArticleOwner(ctx, row.locale);
    if (!(owner.active && owner.managed)) {
      return null;
    }
    const verified = yield* verifyArticle(ctx, row, owner.active.sequence);
    const { projection, resolved } = verified;
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

/** Selects article candidates through locale-bound current indexes. */
function readArticleRows(ctx: QueryCtx, input: ContentReferenceInput) {
  if (input.kind === "route") {
    return Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", input.locale).eq("publicPath", input.publicPath)
        )
        .take(2)
    );
  }
  return Effect.forEach(ContentLocaleSchema.literals, (locale) =>
    Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_assetId", (index) =>
          index.eq("locale", locale).eq("assetId", input.contentId)
        )
        .take(2)
    )
  ).pipe(Effect.map((groups) => groups.flat()));
}

/** Reads one exact active material through its authenticated catalog row. */
const readMaterialReference = Effect.fn("contentRelease.readMaterialReference")(
  function* (ctx: QueryCtx, input: ContentReferenceInput) {
    const rows = yield* readMaterialRows(ctx, input);
    if (rows.length > 1) {
      return yield* identityCollision("material");
    }
    const row = rows[0];
    if (!row) {
      return null;
    }
    const owner = yield* loadMaterialOwner(ctx, row.locale);
    if (!(owner.active && owner.managed)) {
      return null;
    }
    const { projection } = yield* verifyMaterial(row);
    return buildContentSearchDocument({
      ...projection.graph,
      contentHash: row.projectionHash,
      description: projection.metadata.description,
      locale: projection.locale,
      route: projection.publicPath,
      section: "material",
      sourcePath: projection.contentKey,
      syncedAt: row.sequence,
      text: projection.metadata.title,
      title: projection.metadata.title,
    });
  }
);

/** Selects material candidates through locale-bound current indexes. */
function readMaterialRows(ctx: QueryCtx, input: ContentReferenceInput) {
  if (input.kind === "route") {
    return Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", input.locale).eq("publicPath", input.publicPath)
        )
        .take(2)
    );
  }
  return Effect.forEach(ContentLocaleSchema.literals, (locale) =>
    Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_assetId", (index) =>
          index.eq("locale", locale).eq("assetId", input.contentId)
        )
        .take(2)
    )
  ).pipe(Effect.map((groups) => groups.flat()));
}

/** Resolves one Quran route or graph asset through its active signed row. */
const readQuranReference = Effect.fn("contentRelease.readQuranReference")(
  function* (ctx: QueryCtx, input: ContentReferenceInput) {
    const identity = yield* findQuranIdentity(input);
    if (!identity) {
      return null;
    }
    const owner = yield* loadQuranOwner(ctx);
    if (owner.snapshotId === null) {
      return null;
    }
    const signed = yield* readQuranRow(
      ctx,
      owner.snapshotId,
      quranSearchIdentity(identity.locale, identity.surahNumber),
      QuranSearchRowSchema
    );
    if (
      input.kind === "content" &&
      signed.payload.graph.assetId !== input.contentId
    ) {
      return null;
    }
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

/** Finds the sole current Quran route matching one semantic identity. */
const findQuranIdentity = Effect.fn("contentRelease.findQuranIdentity")(
  function* (input: ContentReferenceInput) {
    const locales =
      input.kind === "route" ? [input.locale] : ContentLocaleSchema.literals;
    for (const locale of locales) {
      for (
        let surahNumber = 1;
        surahNumber <= QURAN_SURAH_COUNT;
        surahNumber += 1
      ) {
        const route = `quran/${surahNumber}`;
        if (input.kind === "route") {
          if (input.publicPath === route) {
            return { locale, surahNumber };
          }
          continue;
        }
        const graph = yield* makeLearningGraphIdentity({
          concept: ["quran", "surah", String(surahNumber)],
          learningObject: ["quran-surah", String(surahNumber)],
          lens: ["quran"],
          locale,
        }).pipe(
          Effect.mapError(
            () =>
              new ReleaseError({
                code: "CONTENT_RELEASE_INTEGRITY",
                message: `Current Quran identity is invalid for ${locale}/${surahNumber}.`,
              })
          )
        );
        if (graph.assetId === input.contentId) {
          return { locale, surahNumber };
        }
      }
    }
    return null;
  }
);

/** Resolves one exact public try-out entry from its active signed hierarchy. */
const readTryoutReference = Effect.fn("contentRelease.readTryoutReference")(
  function* (ctx: QueryCtx, input: ContentReferenceInput) {
    const locales =
      input.kind === "route" ? [input.locale] : ContentLocaleSchema.literals;
    const catalogs = yield* Effect.forEach(locales, (locale) =>
      findTryoutCatalog(ctx, locale)
    );
    const matches = catalogs.flatMap((catalog) => {
      if (Option.isNone(catalog)) {
        return [];
      }
      return catalog.value.entries.filter(({ row }) => {
        if (row.publicPath === undefined) {
          return false;
        }
        return input.kind === "route"
          ? row.publicPath === input.publicPath
          : row.graph.assetId === input.contentId;
      });
    });
    if (matches.length > 1) {
      return yield* identityCollision("try-out");
    }
    const entry = matches[0];
    if (!entry?.row.publicPath) {
      return null;
    }
    return buildContentSearchDocument({
      ...entry.row.graph,
      contentHash: entry.rowHash,
      description: entry.row.description,
      locale: entry.row.locale,
      route: entry.row.publicPath,
      section: "tryout",
      sourcePath: entry.row.publicPath,
      syncedAt: entry.index,
      text: "",
      title: entry.row.title,
    });
  }
);

/** Produces one typed exact-identity collision failure. */
function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
