import { QURAN_LOCALES } from "@nakafa/aksara-contracts/quran/spec";
import { query } from "@repo/backend/convex/_generated/server";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import {
  readQuranSitemap,
  readQuranSurahs,
} from "@repo/backend/convex/contentRelease/quran/catalog";
import { readQuranPage } from "@repo/backend/convex/contentRelease/quran/page";
import { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import { searchQuran } from "@repo/backend/convex/contentRelease/quran/search";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const quranLocaleValidator = literals(...QURAN_LOCALES);

const sourceFields = {
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
};

const attributionValidator = v.object({
  ...sourceFields,
  rowJson: v.union(v.string(), v.null()),
});

const surahCatalogValidator = v.object({
  ...sourceFields,
  rowJson: v.array(v.string()),
});

const pageValidator = v.object({
  ...sourceFields,
  chunkJson: v.array(v.string()),
  nextSurahJson: v.union(v.string(), v.null()),
  prevSurahJson: v.union(v.string(), v.null()),
  searchJson: v.union(v.string(), v.null()),
  surahJson: v.union(v.string(), v.null()),
});

const referenceValidator = v.object({
  ...sourceFields,
  chunkJson: v.array(v.string()),
  fromVerse: v.number(),
  searchJson: v.union(v.string(), v.null()),
  surahJson: v.union(v.string(), v.null()),
  toVerse: v.number(),
});

const searchValidator = v.object({
  ...sourceFields,
  rowJson: v.array(v.string()),
});

const sitemapValidator = v.object({
  ...sourceFields,
  locale: quranLocaleValidator,
  routes: v.array(v.string()),
});

/** Returns the visible signed source attribution for active Quran content. */
export const attribution = query({
  args: {},
  returns: attributionValidator,
  handler: (ctx) => runConvexProgram(readQuranAttribution(ctx)),
});

/** Returns every verified Quran surah metadata row without verse bodies. */
export const surahs = query({
  args: {},
  returns: surahCatalogValidator,
  handler: (ctx) => runConvexProgram(readQuranSurahs(ctx)),
});

/** Returns one complete localized Quran page from bounded immutable chunks. */
export const page = query({
  args: { locale: quranLocaleValidator, surahNumber: v.number() },
  returns: pageValidator,
  handler: (ctx, { locale, surahNumber }) =>
    runConvexProgram(readQuranPage(ctx, locale, surahNumber)),
});

/** Returns one bounded localized Quran verse reference. */
export const reference = query({
  args: {
    fromVerse: v.number(),
    locale: quranLocaleValidator,
    surahNumber: v.number(),
    toVerse: v.optional(v.number()),
  },
  returns: referenceValidator,
  handler: (ctx, args) => runConvexProgram(readQuranReference(ctx, args)),
});

/** Returns relevance-ranked localized Quran search rows under a hard bound. */
export const search = query({
  args: { locale: quranLocaleValidator, query: v.string() },
  returns: searchValidator,
  handler: (ctx, { locale, query: sourceQuery }) =>
    runConvexProgram(searchQuran(ctx, locale, sourceQuery)),
});

/** Returns canonical Quran sitemap paths for one supported locale. */
export const sitemap = query({
  args: { locale: quranLocaleValidator },
  returns: sitemapValidator,
  handler: (ctx, { locale }) => runConvexProgram(readQuranSitemap(ctx, locale)),
});
