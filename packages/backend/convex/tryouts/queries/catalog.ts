import { query } from "@repo/backend/convex/_generated/server";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  featuredTryoutValidator,
  readFeaturedTryout,
} from "@repo/backend/convex/tryouts/catalog/featured";
import {
  readTryoutLocalizedPath,
  readTryoutMetadata,
  tryoutLocalizedPathArgsValidator,
  tryoutMetadataArgsValidator,
  tryoutMetadataReturnValidator,
} from "@repo/backend/convex/tryouts/catalog/metadata";
import {
  readPublishedCountryPage,
  readPublishedExamPage,
  readPublishedHubPage,
  readPublishedSectionPageFromIndex,
  readPublishedSetPageFromIndex,
  readPublishedTrackPage,
} from "@repo/backend/convex/tryouts/catalog/published";
import { readTryoutSetSelection } from "@repo/backend/convex/tryouts/catalog/selection";
import {
  publicTryoutCountryValidator,
  publicTryoutCountryWithExamCountValidator,
  publicTryoutExamValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import { v } from "convex/values";
import { Effect } from "effect";

const sectionPageFields = {
  exam: publicTryoutExamValidator,
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
};
const sectionPageValidator = v.union(v.null(), v.object(sectionPageFields));

/** Reads the one signed question demonstrated on the marketing landing page. */
export const getFeaturedQuestion = query({
  args: {
    appLocale: appLocaleValidator,
  },
  returns: featuredTryoutValidator,
  handler: (ctx, args) =>
    runConvexProgram(readFeaturedTryout(ctx, args.appLocale)),
});

/** Reads exact SEO copy and localized paths from signed try-out ownership. */
export const getMetadata = query({
  args: tryoutMetadataArgsValidator,
  returns: tryoutMetadataReturnValidator,
  handler: (ctx, args) => runConvexProgram(readTryoutMetadata(ctx, args)),
});

/** Resolves one signed try-out route to its exact localized counterpart. */
export const getLocalizedPath = query({
  args: tryoutLocalizedPathArgsValidator,
  returns: v.union(v.string(), v.null()),
  handler: (ctx, args) => runConvexProgram(readTryoutLocalizedPath(ctx, args)),
});

/** Reads the localized country-first try-out hub page model. */
export const getHubPage = query({
  args: {
    appLocale: appLocaleValidator,
  },
  returns: v.object({
    countries: v.array(publicTryoutCountryWithExamCountValidator),
    sourceRevision: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(ctx, args.appLocale)
    );
    const page = await runConvexProgram(readPublishedHubPage(catalog));
    return { ...page, sourceRevision: catalog.sourceRevision };
  },
});

/** Reads one active country page with its active exam family rows. */
export const getCountryPage = query({
  args: {
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exams: v.array(publicTryoutExamValidator),
      sourceRevision: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(ctx, args.appLocale)
    );
    const page = await runConvexProgram(
      readPublishedCountryPage(catalog, args.publicPath)
    );
    return page ? { ...page, sourceRevision: catalog.sourceRevision } : null;
  },
});

/** Reads one active exam page with its active track rows. */
export const getExamPage = query({
  args: {
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exam: publicTryoutExamValidator,
      tracks: v.array(publicTryoutTrackValidator),
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(ctx, args.appLocale)
    );
    return await runConvexProgram(
      readPublishedExamPage(catalog, args.publicPath)
    );
  },
});

/** Reads one active track page shell for paginated set discovery. */
export const getTrackPage = query({
  args: {
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exam: publicTryoutExamValidator,
      track: publicTryoutTrackValidator,
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(ctx, args.appLocale)
    );
    return await runConvexProgram(
      readPublishedTrackPage(catalog, args.publicPath)
    );
  },
});

/** Reads one try-out set and its ordered sections. */
export const getSetPage = query({
  args: {
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      exam: publicTryoutExamValidator,
      entrySection: v.union(publicTryoutSectionValidator, v.null()),
      set: publicTryoutSetValidator,
      sections: v.array(publicTryoutSectionValidator),
      track: publicTryoutTrackValidator,
    })
  ),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const owner = yield* loadTryoutOwner(ctx);
        const index = yield* readTryoutSetSelection(ctx, {
          ...args,
          snapshotId: owner.snapshotId,
        });
        if (!index) {
          return null;
        }
        return yield* readPublishedSetPageFromIndex(index, args.publicPath);
      })
    ),
});

/** Reads public metadata for one try-out section. */
export const getSectionPage = query({
  args: {
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  },
  returns: sectionPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const owner = yield* loadTryoutOwner(ctx);
        const index = yield* readTryoutSetSelection(ctx, {
          ...args,
          snapshotId: owner.snapshotId,
        });
        if (!index) {
          return null;
        }
        return yield* readPublishedSectionPageFromIndex(index, args.publicPath);
      })
    ),
});
