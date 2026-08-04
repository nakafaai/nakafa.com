import { query } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  readFilesystemSection,
  readFilesystemSet,
} from "@repo/backend/convex/tryouts/catalog/filesystem/content";
import {
  readFilesystemCountry,
  readFilesystemExam,
  readFilesystemHub,
  readFilesystemTrack,
} from "@repo/backend/convex/tryouts/catalog/filesystem/discovery";
import {
  readTryoutMetadata,
  tryoutMetadataArgsValidator,
  tryoutMetadataReturnValidator,
} from "@repo/backend/convex/tryouts/catalog/metadata";
import {
  readPublishedCountryPage,
  readPublishedExamPage,
  readPublishedHubPage,
  readPublishedSectionPage,
  readPublishedSetPage,
  readPublishedTrackPage,
} from "@repo/backend/convex/tryouts/catalog/published";
import { readTryoutRoute } from "@repo/backend/convex/tryouts/catalog/route";
import {
  publicTryoutCountryValidator,
  publicTryoutCountryWithExamCountValidator,
  publicTryoutExamValidator,
  publicTryoutQuestionContentValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import { v } from "convex/values";

const sectionPageFields = {
  exam: publicTryoutExamValidator,
  questions: v.array(publicTryoutQuestionContentValidator),
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
};
const sectionPageValidator = v.union(v.null(), v.object(sectionPageFields));

/** Checks one exact public route against its active signed try-out owner. */
export const getRoute = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.object({
    exists: v.boolean(),
    managed: v.boolean(),
  }),
  handler: (ctx, args) => runConvexProgram(readTryoutRoute(ctx, args)),
});

/** Reads exact SEO copy and localized paths from signed try-out ownership. */
export const getMetadata = query({
  args: tryoutMetadataArgsValidator,
  returns: tryoutMetadataReturnValidator,
  handler: (ctx, args) => runConvexProgram(readTryoutMetadata(ctx, args)),
});

/** Reads the localized country-first try-out hub page model. */
export const getHubPage = query({
  args: {
    locale: localeValidator,
  },
  returns: v.object({
    countries: v.array(publicTryoutCountryWithExamCountValidator),
    managed: v.boolean(),
    sourceRevision: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      const page = await runConvexProgram(readPublishedHubPage(catalog));
      return { ...page, managed: true, sourceRevision: catalog.sourceRevision };
    }
    const page = await runConvexProgram(readFilesystemHub(ctx, args.locale));
    return { ...page, managed: false, sourceRevision: null };
  },
});

/** Reads one active country page with its active exam family rows. */
export const getCountryPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exams: v.array(publicTryoutExamValidator),
      managed: v.boolean(),
      sourceRevision: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      const page = await runConvexProgram(
        readPublishedCountryPage(catalog, args.publicPath)
      );
      return page
        ? { ...page, managed: true, sourceRevision: catalog.sourceRevision }
        : null;
    }
    const page = await runConvexProgram(readFilesystemCountry(ctx, args));
    return page ? { ...page, managed: false, sourceRevision: null } : null;
  },
});

/** Reads one active exam page with its active track rows. */
export const getExamPage = query({
  args: {
    locale: localeValidator,
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
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedExamPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemExam(ctx, args));
  },
});

/** Reads one active track page shell for paginated set discovery. */
export const getTrackPage = query({
  args: {
    locale: localeValidator,
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
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedTrackPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemTrack(ctx, args));
  },
});

/** Reads one try-out set and its ordered sections. */
export const getSetPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      exam: publicTryoutExamValidator,
      entryQuestions: v.array(publicTryoutQuestionContentValidator),
      entrySection: v.union(publicTryoutSectionValidator, v.null()),
      set: publicTryoutSetValidator,
      sections: v.array(publicTryoutSectionValidator),
      track: publicTryoutTrackValidator,
    })
  ),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedSetPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemSet(ctx, args));
  },
});

/** Reads public metadata for one try-out section. */
export const getSectionPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: sectionPageValidator,
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    if (catalog.managed) {
      return await runConvexProgram(
        readPublishedSectionPage(catalog, args.publicPath)
      );
    }
    return await runConvexProgram(readFilesystemSection(ctx, args));
  },
});
