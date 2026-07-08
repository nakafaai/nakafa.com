import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import {
  type Locale,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  loadQuestionContentRows,
  loadReadySections,
  publicTryoutCountryValidator,
  publicTryoutCountryWithExamCountValidator,
  publicTryoutExamValidator,
  publicTryoutQuestionContentValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
  toPublicTryoutCountry,
  toPublicTryoutExam,
  toPublicTryoutSection,
  toPublicTryoutSet,
  toPublicTryoutTrack,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const CATALOG_PAGE_LIMIT = 100;

const emptySetPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};

/** Reads the localized country-first try-out hub page model. */
export const getHubPage = query({
  args: {
    locale: localeValidator,
  },
  returns: v.object({
    countries: v.array(publicTryoutCountryWithExamCountValidator),
  }),
  handler: async (ctx, args) => {
    const countries = await ctx.db
      .query("tryoutCountries")
      .withIndex("by_locale_and_isActive_and_order", (q) =>
        q.eq("locale", args.locale).eq("isActive", true)
      )
      .take(CATALOG_PAGE_LIMIT);

    const countryRows = await Promise.all(
      countries.map(async (country) => {
        const exams = await ctx.db
          .query("tryoutExams")
          .withIndex("by_countryKey_and_locale_and_isActive_and_order", (q) =>
            q
              .eq("countryKey", country.countryKey)
              .eq("locale", args.locale)
              .eq("isActive", true)
          )
          .take(CATALOG_PAGE_LIMIT);

        return {
          examCount: exams.length,
          ...toPublicTryoutCountry(country),
        };
      })
    );

    return { countries: countryRows };
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
    })
  ),
  handler: async (ctx, args) => {
    const country = await ctx.db
      .query("tryoutCountries")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!country?.isActive) {
      return null;
    }

    const exams = await ctx.db
      .query("tryoutExams")
      .withIndex("by_countryKey_and_locale_and_isActive_and_order", (q) =>
        q
          .eq("countryKey", country.countryKey)
          .eq("locale", args.locale)
          .eq("isActive", true)
      )
      .take(CATALOG_PAGE_LIMIT);

    return {
      country: toPublicTryoutCountry(country),
      exams: exams.map(toPublicTryoutExam),
    };
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
    const exam = await ctx.db
      .query("tryoutExams")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!exam?.isActive) {
      return null;
    }

    const [country, tracks] = await Promise.all([
      ctx.db
        .query("tryoutCountries")
        .withIndex("by_countryKey_and_locale", (q) =>
          q.eq("countryKey", exam.countryKey).eq("locale", args.locale)
        )
        .unique(),
      ctx.db
        .query("tryoutTracks")
        .withIndex(
          "by_countryKey_and_examKey_and_locale_and_isActive_and_order",
          (q) =>
            q
              .eq("countryKey", exam.countryKey)
              .eq("examKey", exam.examKey)
              .eq("locale", args.locale)
              .eq("isActive", true)
        )
        .take(CATALOG_PAGE_LIMIT),
    ]);

    if (!country?.isActive) {
      return null;
    }

    const readyTracks = tracks.filter((track) => track.isReady);

    return {
      country: toPublicTryoutCountry(country),
      exam: toPublicTryoutExam(exam),
      tracks: readyTracks.map(toPublicTryoutTrack),
    };
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
    const track = await ctx.db
      .query("tryoutTracks")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!(track?.isActive && track.isReady)) {
      return null;
    }

    const [country, exam] = await Promise.all([
      ctx.db
        .query("tryoutCountries")
        .withIndex("by_countryKey_and_locale", (q) =>
          q.eq("countryKey", track.countryKey).eq("locale", args.locale)
        )
        .unique(),
      ctx.db
        .query("tryoutExams")
        .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
          q
            .eq("countryKey", track.countryKey)
            .eq("examKey", track.examKey)
            .eq("locale", args.locale)
        )
        .unique(),
    ]);

    if (!(country?.isActive && exam?.isActive)) {
      return null;
    }

    return {
      country: toPublicTryoutCountry(country),
      exam: toPublicTryoutExam(exam),
      track: toPublicTryoutTrack(track),
    };
  },
});

/** Lists ready sets for one active track using Convex pagination. */
export const listTrackSets = query({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: paginationResultValidator(publicTryoutSetValidator),
  handler: async (ctx, args) => {
    const hasReadyTrackParent = await readReadyTrackParent(ctx, args);

    if (!hasReadyTrackParent) {
      return emptySetPage;
    }

    const page = await ctx.db
      .query("tryoutSets")
      .withIndex("by_track_locale_active_ready_order", (q) =>
        q
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", args.trackKey)
          .eq("locale", args.locale)
          .eq("isActive", true)
          .eq("isReady", true)
      )
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map(toPublicTryoutSet),
    };
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
      entrySection: v.union(publicTryoutSectionValidator, v.null()),
      set: publicTryoutSetValidator,
      sections: v.array(publicTryoutSectionValidator),
      track: publicTryoutTrackValidator,
    })
  ),
  handler: async (ctx, args) => {
    const set = await ctx.db
      .query("tryoutSets")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!(set?.isActive && set.isReady)) {
      return null;
    }

    const [exam, track, readySections] = await Promise.all([
      ctx.db
        .query("tryoutExams")
        .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
          q
            .eq("countryKey", set.countryKey)
            .eq("examKey", set.examKey)
            .eq("locale", args.locale)
        )
        .unique(),
      ctx.db
        .query("tryoutTracks")
        .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
          q
            .eq("countryKey", set.countryKey)
            .eq("examKey", set.examKey)
            .eq("trackKey", set.trackKey)
            .eq("locale", args.locale)
        )
        .unique(),
      loadReadySections(ctx, set),
    ]);

    if (!(exam?.isActive && track?.isActive && track.isReady)) {
      return null;
    }

    if (!readySections) {
      return null;
    }

    const visibleSections = readySections.filter(
      (section) => section.visibility === "visible" && section.publicPath
    );
    const entrySection =
      readySections.find(
        (section) => section.sectionKey === set.internalEntrySectionKey
      ) ??
      visibleSections[0] ??
      null;

    return {
      exam: toPublicTryoutExam(exam),
      entrySection: entrySection ? toPublicTryoutSection(entrySection) : null,
      set: toPublicTryoutSet(set),
      sections: visibleSections.map(toPublicTryoutSection),
      track: toPublicTryoutTrack(track),
    };
  },
});

async function readReadyTrackParent(
  ctx: QueryCtx,
  args: {
    countryKey: string;
    examKey: string;
    locale: Locale;
    trackKey: string;
  }
) {
  const [country, exam, track] = await Promise.all([
    ctx.db
      .query("tryoutCountries")
      .withIndex("by_countryKey_and_locale", (q) =>
        q.eq("countryKey", args.countryKey).eq("locale", args.locale)
      )
      .unique(),
    ctx.db
      .query("tryoutExams")
      .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
        q
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("locale", args.locale)
      )
      .unique(),
    ctx.db
      .query("tryoutTracks")
      .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
        q
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", args.trackKey)
          .eq("locale", args.locale)
      )
      .unique(),
  ]);

  return Boolean(
    country?.isActive && exam?.isActive && track?.isActive && track.isReady
  );
}

/** Reads public metadata for one try-out section. */
export const getSectionPage = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      exam: publicTryoutExamValidator,
      questions: v.array(publicTryoutQuestionContentValidator),
      section: publicTryoutSectionValidator,
      set: publicTryoutSetValidator,
      track: publicTryoutTrackValidator,
    })
  ),
  handler: async (ctx, args) => {
    const section = await ctx.db
      .query("tryoutSections")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!(section?.visibility === "visible" && section.publicPath)) {
      return null;
    }

    const set = await ctx.db.get(section.tryoutSetId);

    if (!(set?.isActive && set.isReady)) {
      return null;
    }

    const [exam, track, readySections] = await Promise.all([
      ctx.db
        .query("tryoutExams")
        .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
          q
            .eq("countryKey", set.countryKey)
            .eq("examKey", set.examKey)
            .eq("locale", args.locale)
        )
        .unique(),
      ctx.db
        .query("tryoutTracks")
        .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
          q
            .eq("countryKey", set.countryKey)
            .eq("examKey", set.examKey)
            .eq("trackKey", set.trackKey)
            .eq("locale", args.locale)
        )
        .unique(),
      loadReadySections(ctx, set),
    ]);

    if (!(exam?.isActive && track?.isActive && track.isReady)) {
      return null;
    }

    const readySection = readySections?.find(
      (item) => item._id === section._id
    );

    if (!readySection) {
      return null;
    }

    const questions = await loadQuestionContentRows(ctx, readySection);

    return {
      exam: toPublicTryoutExam(exam),
      questions,
      section: toPublicTryoutSection(section),
      set: toPublicTryoutSet(set),
      track: toPublicTryoutTrack(track),
    };
  },
});
