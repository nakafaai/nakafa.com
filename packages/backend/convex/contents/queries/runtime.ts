import { query } from "@repo/backend/convex/_generated/server";
import {
  listArticleApiContentPageImpl,
  listMaterialApiContentPageImpl,
} from "@repo/backend/convex/contents/runtime/api";
import { getArticlePageImpl } from "@repo/backend/convex/contents/runtime/articles";
import {
  getContentRouteArtifactPageImpl,
  getContentRouteByContentIdImpl,
  getContentRouteBySourcePathImpl,
  getContentRouteImpl,
  getPublicRouteByPathImpl,
  listContentRouteCountsImpl,
  listContentRoutesByKindPrefixImpl,
  listContentRoutesByParentImpl,
  listContentRoutesByPrefixImpl,
  listLatestContentRoutesImpl,
  listPublicRoutesByMaterialImpl,
  listPublicRoutesByParentImpl,
  listSitemapPublicRoutesImpl,
} from "@repo/backend/convex/contents/runtime/catalog";
import { getCurriculumPageImpl } from "@repo/backend/convex/contents/runtime/curriculum";
import {
  getQuranReferenceImpl,
  getQuranSurahMetadataImpl,
  getQuranSurahPageImpl,
  listQuranSurahsImpl,
} from "@repo/backend/convex/contents/runtime/quran";
import {
  getPublicRouteByPathArgsValidator,
  getPublicRouteByPathReturnValidator,
  listPublicRoutesByMaterialArgsValidator,
  listPublicRoutesByMaterialReturnValidator,
  listPublicRoutesByParentArgsValidator,
  listPublicRoutesPageReturnValidator,
  listSitemapPublicRoutesArgsValidator,
  listSitemapPublicRoutesReturnValidator,
} from "@repo/backend/convex/contents/runtime/routes";
import {
  getArticlePageArgsValidator,
  getArticlePageReturnValidator,
  getContentRouteArgsValidator,
  getContentRouteArtifactPageArgsValidator,
  getContentRouteArtifactPageReturnValidator,
  getContentRouteByContentIdArgsValidator,
  getContentRouteByContentIdReturnValidator,
  getContentRouteBySourcePathArgsValidator,
  getContentRouteBySourcePathReturnValidator,
  getContentRouteReturnValidator,
  getCurriculumPageArgsValidator,
  getCurriculumPageReturnValidator,
  getQuranReferenceArgsValidator,
  getQuranReferenceReturnValidator,
  getQuranSurahMetadataArgsValidator,
  getQuranSurahMetadataReturnValidator,
  getQuranSurahPageArgsValidator,
  getQuranSurahPageReturnValidator,
  listArticleApiContentPageArgsValidator,
  listArticleApiContentPageReturnValidator,
  listContentRouteCountsArgsValidator,
  listContentRouteCountsReturnValidator,
  listContentRoutesByKindPrefixArgsValidator,
  listContentRoutesByParentArgsValidator,
  listContentRoutesByPrefixArgsValidator,
  listContentRoutesPageReturnValidator,
  listLatestContentRoutesArgsValidator,
  listLatestContentRoutesReturnValidator,
  listMaterialApiContentPageArgsValidator,
  listMaterialApiContentPageReturnValidator,
  listQuranSurahsReturnValidator,
} from "@repo/backend/convex/contents/runtime/spec";

/**
 * Loads one published article page from the durable content read model.
 */
export const getArticlePage = query({
  args: getArticlePageArgsValidator,
  returns: getArticlePageReturnValidator,
  handler: getArticlePageImpl,
});

/**
 * Loads one published curriculum lesson from the durable content read model.
 */
export const getCurriculumPage = query({
  args: getCurriculumPageArgsValidator,
  returns: getCurriculumPageReturnValidator,
  handler: getCurriculumPageImpl,
});

/** Lists concrete content routes matching one locale, section, and prefix. */
export const listContentRoutesByPrefix = query({
  args: listContentRoutesByPrefixArgsValidator,
  returns: listContentRoutesPageReturnValidator,
  /** Runs a bounded route-catalog page query with generated argument typing. */
  handler: (ctx, args) => listContentRoutesByPrefixImpl(ctx, args),
});

/** Lists concrete content routes matching one locale, section, kind, and prefix. */
export const listContentRoutesByKindPrefix = query({
  args: listContentRoutesByKindPrefixArgsValidator,
  returns: listContentRoutesPageReturnValidator,
  /** Runs a bounded kind-scoped route-catalog page query. */
  handler: (ctx, args) => listContentRoutesByKindPrefixImpl(ctx, args),
});

/** Lists concrete content routes matching one materialized navigation parent. */
export const listContentRoutesByParent = query({
  args: listContentRoutesByParentArgsValidator,
  returns: listContentRoutesPageReturnValidator,
  /** Runs a bounded parent-scoped route-catalog page query. */
  handler: (ctx, args) => listContentRoutesByParentImpl(ctx, args),
});

/** Reads one materialized content route page for sitemap and agent artifacts. */
export const getContentRouteArtifactPage = query({
  args: getContentRouteArtifactPageArgsValidator,
  returns: getContentRouteArtifactPageReturnValidator,
  handler: (ctx, args) => getContentRouteArtifactPageImpl(ctx, args),
});

/** Lists newest dated content routes without scanning the full catalog. */
export const listLatestContentRoutes = query({
  args: listLatestContentRoutesArgsValidator,
  returns: listLatestContentRoutesReturnValidator,
  handler: (ctx, args) => listLatestContentRoutesImpl(ctx, args),
});

/** Lists materialized route counts for one locale. */
export const listContentRouteCounts = query({
  args: listContentRouteCountsArgsValidator,
  returns: listContentRouteCountsReturnValidator,
  handler: (ctx, args) => listContentRouteCountsImpl(ctx, args),
});

/** Loads one source-owned public route by localized public path. */
export const getPublicRouteByPath = query({
  args: getPublicRouteByPathArgsValidator,
  returns: getPublicRouteByPathReturnValidator,
  handler: getPublicRouteByPathImpl,
});

/** Lists bounded public route children by context parent and optional program. */
export const listPublicRoutesByParent = query({
  args: listPublicRoutesByParentArgsValidator,
  returns: listPublicRoutesPageReturnValidator,
  handler: (ctx, args) => listPublicRoutesByParentImpl(ctx, args),
});

/** Lists bounded localized route contexts that point at one material key. */
export const listPublicRoutesByMaterial = query({
  args: listPublicRoutesByMaterialArgsValidator,
  returns: listPublicRoutesByMaterialReturnValidator,
  handler: (ctx, args) => listPublicRoutesByMaterialImpl(ctx, args),
});

/** Lists bounded sitemap-eligible public route rows by locale. */
export const listSitemapPublicRoutes = query({
  args: listSitemapPublicRoutesArgsValidator,
  returns: listSitemapPublicRoutesReturnValidator,
  handler: (ctx, args) => listSitemapPublicRoutesImpl(ctx, args),
});

/** Loads one concrete content route from the durable route catalog. */
export const getContentRoute = query({
  args: getContentRouteArgsValidator,
  returns: getContentRouteReturnValidator,
  handler: getContentRouteImpl,
});

/** Loads one concrete content route by graph-backed content ID. */
export const getContentRouteByContentId = query({
  args: getContentRouteByContentIdArgsValidator,
  returns: getContentRouteByContentIdReturnValidator,
  handler: getContentRouteByContentIdImpl,
});

/** Loads one concrete content route by source-owned material or article path. */
export const getContentRouteBySourcePath = query({
  args: getContentRouteBySourcePathArgsValidator,
  returns: getContentRouteBySourcePathReturnValidator,
  handler: getContentRouteBySourcePathImpl,
});

/** Lists article API rows matching one route prefix. */
export const listArticleApiContentPage = query({
  args: listArticleApiContentPageArgsValidator,
  returns: listArticleApiContentPageReturnValidator,
  /** Runs a bounded article API content page query with generated argument typing. */
  handler: (ctx, args) => listArticleApiContentPageImpl(ctx, args),
});

/** Lists material API rows matching one route prefix. */
export const listMaterialApiContentPage = query({
  args: listMaterialApiContentPageArgsValidator,
  returns: listMaterialApiContentPageReturnValidator,
  /** Runs a bounded material API content page query with generated argument typing. */
  handler: (ctx, args) => listMaterialApiContentPageImpl(ctx, args),
});

/** Lists synced Quran surah metadata rows. */
export const listQuranSurahs = query({
  args: {},
  returns: listQuranSurahsReturnValidator,
  handler: listQuranSurahsImpl,
});

/** Loads one Quran surah metadata row without verse payloads. */
export const getQuranSurahMetadata = query({
  args: getQuranSurahMetadataArgsValidator,
  returns: getQuranSurahMetadataReturnValidator,
  handler: getQuranSurahMetadataImpl,
});

/** Loads one Quran surah page from the durable Quran runtime rows. */
export const getQuranSurahPage = query({
  args: getQuranSurahPageArgsValidator,
  returns: getQuranSurahPageReturnValidator,
  handler: getQuranSurahPageImpl,
});

/** Loads a bounded Quran verse reference from the durable Quran runtime rows. */
export const getQuranReference = query({
  args: getQuranReferenceArgsValidator,
  returns: getQuranReferenceReturnValidator,
  handler: getQuranReferenceImpl,
});
