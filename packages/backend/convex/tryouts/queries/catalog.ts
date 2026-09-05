import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import {
  featuredTryoutValidator,
  readFeaturedTryout,
} from "@repo/backend/content/tryout/featured";
import {
  readTryoutLocalizedPath,
  readTryoutMetadata,
  tryoutLocalizedPathArgsValidator,
  tryoutMetadataArgsValidator,
  tryoutMetadataReturnValidator,
} from "@repo/backend/content/tryout/metadata";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutSectionPage,
  readTryoutSetPage,
  readTryoutTrackPage,
  tryoutHubArgsValidator,
  tryoutPageArgsValidator,
} from "@repo/backend/content/tryout/page";
import { query } from "@repo/backend/convex/_generated/server";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
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
    runConvexProgram(
      readFeaturedTryout(args.appLocale).pipe(
        Effect.provide(convexTryoutLayer(ctx))
      )
    ),
});

/** Reads exact SEO copy and localized paths from signed try-out ownership. */
export const getMetadata = query({
  args: tryoutMetadataArgsValidator,
  returns: tryoutMetadataReturnValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutMetadata(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Resolves one signed try-out route to its exact localized counterpart. */
export const getLocalizedPath = query({
  args: tryoutLocalizedPathArgsValidator,
  returns: v.union(v.string(), v.null()),
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutLocalizedPath(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Reads the localized country-first try-out hub page model. */
export const getHubPage = query({
  args: tryoutHubArgsValidator.fields,
  returns: v.object({
    countries: v.array(publicTryoutCountryWithExamCountValidator),
    sourceRevision: v.union(v.string(), v.null()),
  }),
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutHubPage(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Reads one active country page with its active exam family rows. */
export const getCountryPage = query({
  args: tryoutPageArgsValidator.fields,
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exams: v.array(publicTryoutExamValidator),
      sourceRevision: v.union(v.string(), v.null()),
    })
  ),
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutCountryPage(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Reads one active exam page with its active track rows. */
export const getExamPage = query({
  args: tryoutPageArgsValidator.fields,
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exam: publicTryoutExamValidator,
      tracks: v.array(publicTryoutTrackValidator),
    })
  ),
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutExamPage(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Reads one active track page shell for paginated set discovery. */
export const getTrackPage = query({
  args: tryoutPageArgsValidator.fields,
  returns: v.union(
    v.null(),
    v.object({
      country: publicTryoutCountryValidator,
      exam: publicTryoutExamValidator,
      track: publicTryoutTrackValidator,
    })
  ),
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutTrackPage(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Reads one try-out set and its ordered sections. */
export const getSetPage = query({
  args: tryoutPageArgsValidator.fields,
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
      readTryoutSetPage(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});

/** Reads public metadata for one try-out section. */
export const getSectionPage = query({
  args: tryoutPageArgsValidator.fields,
  returns: sectionPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readTryoutSectionPage(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});
