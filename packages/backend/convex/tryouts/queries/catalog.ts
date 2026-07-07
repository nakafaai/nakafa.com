import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  tryoutRouteKeyValidator,
  tryoutScoringStrategyValidator,
} from "@repo/backend/convex/tryouts/schema";
import { readTryoutCountryCode } from "@repo/contents/_types/tryout/countries";
import { ConvexError, v } from "convex/values";

const CATALOG_PAGE_LIMIT = 100;

const publicTryoutCountryValidator = v.object({
  countryCode: v.string(),
  countryKey: tryoutRouteKeyValidator,
  description: v.optional(v.string()),
  publicPath: v.string(),
  title: v.string(),
});

const publicTryoutCountryWithExamCountValidator = v.object({
  ...publicTryoutCountryValidator.fields,
  examCount: v.number(),
});

const publicTryoutExamValidator = v.object({
  description: v.optional(v.string()),
  examKey: tryoutRouteKeyValidator,
  publicPath: v.string(),
  scoringStrategy: tryoutScoringStrategyValidator,
  title: v.string(),
});

const publicTryoutSetValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  description: v.optional(v.string()),
  examKey: tryoutRouteKeyValidator,
  publicPath: v.string(),
  scoringStrategy: tryoutScoringStrategyValidator,
  sectionCount: v.number(),
  setKey: tryoutRouteKeyValidator,
  title: v.string(),
  totalQuestionCount: v.number(),
});

const publicTryoutSectionValidator = v.object({
  description: v.optional(v.string()),
  publicPath: v.string(),
  questionCount: v.number(),
  sectionKey: tryoutRouteKeyValidator,
  timeLimitSeconds: v.number(),
  title: v.string(),
});

const publicTryoutQuestionContentValidator = v.object({
  contentHash: v.string(),
  questionOrder: v.number(),
  sourcePath: v.string(),
  sourceRevision: v.string(),
});

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
          countryCode: readSourceCountryCode(country.countryKey),
          countryKey: country.countryKey,
          description: country.description,
          examCount: exams.length,
          publicPath: country.publicPath,
          title: country.title,
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
      country: {
        countryCode: readSourceCountryCode(country.countryKey),
        countryKey: country.countryKey,
        description: country.description,
        publicPath: country.publicPath,
        title: country.title,
      },
      exams: exams.map((exam) => ({
        description: exam.description,
        examKey: exam.examKey,
        publicPath: exam.publicPath,
        scoringStrategy: exam.scoringStrategy,
        title: exam.title,
      })),
    };
  },
});

/** Reads one active exam page with its active try-out set rows. */
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
      sets: v.array(publicTryoutSetValidator),
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

    const [country, sets] = await Promise.all([
      ctx.db
        .query("tryoutCountries")
        .withIndex("by_countryKey_and_locale", (q) =>
          q.eq("countryKey", exam.countryKey).eq("locale", args.locale)
        )
        .unique(),
      ctx.db
        .query("tryoutSets")
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

    return {
      country: {
        countryCode: readSourceCountryCode(country.countryKey),
        countryKey: country.countryKey,
        description: country.description,
        publicPath: country.publicPath,
        title: country.title,
      },
      exam: {
        description: exam.description,
        examKey: exam.examKey,
        publicPath: exam.publicPath,
        scoringStrategy: exam.scoringStrategy,
        title: exam.title,
      },
      sets: sets.map((set) => ({
        countryKey: set.countryKey,
        description: set.description,
        examKey: set.examKey,
        publicPath: set.publicPath,
        scoringStrategy: set.scoringStrategy,
        sectionCount: set.sectionCount,
        setKey: set.setKey,
        title: set.title,
        totalQuestionCount: set.totalQuestionCount,
      })),
    };
  },
});

function readSourceCountryCode(countryKey: string) {
  const countryCode = readTryoutCountryCode(countryKey);

  if (!countryCode) {
    throw new ConvexError({
      code: "TRYOUT_COUNTRY_SOURCE_NOT_FOUND",
      message: "Try-out country source not found.",
    });
  }

  return countryCode;
}

/** Loads bounded public question content keys for server-side MDX rendering. */
async function loadQuestionContentRows(
  ctx: QueryCtx,
  section: Doc<"tryoutSections">
) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", section.questionSetId)
    )
    .take(section.questionCount + 1);

  if (questions.length !== section.questionCount) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_COUNT_MISMATCH",
      message: "Try-out section question count is not synced.",
    });
  }

  return questions.map((question) => ({
    contentHash: question.contentHash,
    questionOrder: question.number,
    sourcePath: question.sourcePath,
    sourceRevision: question.sourceRevision,
  }));
}

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
      set: publicTryoutSetValidator,
      sections: v.array(publicTryoutSectionValidator),
    })
  ),
  handler: async (ctx, args) => {
    const set = await ctx.db
      .query("tryoutSets")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!set?.isActive) {
      return null;
    }

    const [exam, sections] = await Promise.all([
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
        .query("tryoutSections")
        .withIndex("by_tryoutSetId_and_order", (q) =>
          q.eq("tryoutSetId", set._id)
        )
        .take(set.sectionCount + 1),
    ]);

    if (!exam?.isActive) {
      return null;
    }

    if (sections.length > set.sectionCount) {
      throw new ConvexError({
        code: "TRYOUT_SECTION_COUNT_EXCEEDED",
        message: "Try-out set has more sections than its snapshot count.",
      });
    }

    if (sections.length < set.sectionCount) {
      return null;
    }

    return {
      exam: {
        description: exam.description,
        examKey: exam.examKey,
        publicPath: exam.publicPath,
        scoringStrategy: exam.scoringStrategy,
        title: exam.title,
      },
      set: {
        countryKey: set.countryKey,
        description: set.description,
        examKey: set.examKey,
        publicPath: set.publicPath,
        scoringStrategy: set.scoringStrategy,
        sectionCount: set.sectionCount,
        setKey: set.setKey,
        title: set.title,
        totalQuestionCount: set.totalQuestionCount,
      },
      sections: sections.map((section) => ({
        description: section.description,
        publicPath: section.publicPath,
        questionCount: section.questionCount,
        sectionKey: section.sectionKey,
        timeLimitSeconds: section.timeLimitSeconds,
        title: section.title,
      })),
    };
  },
});

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
    })
  ),
  handler: async (ctx, args) => {
    const section = await ctx.db
      .query("tryoutSections")
      .withIndex("by_locale_and_publicPath", (q) =>
        q.eq("locale", args.locale).eq("publicPath", args.publicPath)
      )
      .unique();

    if (!section) {
      return null;
    }

    const set = await ctx.db.get(section.tryoutSetId);

    if (!set?.isActive) {
      return null;
    }

    const [exam, questions] = await Promise.all([
      ctx.db
        .query("tryoutExams")
        .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
          q
            .eq("countryKey", set.countryKey)
            .eq("examKey", set.examKey)
            .eq("locale", args.locale)
        )
        .unique(),
      loadQuestionContentRows(ctx, section),
    ]);

    if (!exam?.isActive) {
      return null;
    }

    return {
      exam: {
        description: exam.description,
        examKey: exam.examKey,
        publicPath: exam.publicPath,
        scoringStrategy: exam.scoringStrategy,
        title: exam.title,
      },
      questions,
      section: {
        description: section.description,
        publicPath: section.publicPath,
        questionCount: section.questionCount,
        sectionKey: section.sectionKey,
        timeLimitSeconds: section.timeLimitSeconds,
        title: section.title,
      },
      set: {
        countryKey: set.countryKey,
        description: set.description,
        examKey: set.examKey,
        publicPath: set.publicPath,
        scoringStrategy: set.scoringStrategy,
        sectionCount: set.sectionCount,
        setKey: set.setKey,
        title: set.title,
        totalQuestionCount: set.totalQuestionCount,
      },
    };
  },
});
