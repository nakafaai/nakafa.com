import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  tryoutRouteKeyValidator,
  tryoutScoringStrategyValidator,
} from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const CATALOG_PAGE_LIMIT = 100;
const CHOICE_LIMIT_PER_QUESTION = 10;

interface PublicQuestionPayload {
  choices: PublicQuestionChoicePayload[];
  contentHash: string;
  number: number;
  questionBody: string;
  questionId: Id<"questions">;
  sourceKey: string;
  sourceRevision: string;
  title: string;
}

interface PublicQuestionChoicePayload {
  label: string;
  optionKey: string;
  order: number;
}

const publicChoiceValidator = v.object({
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const publicQuestionValidator = v.object({
  contentHash: v.string(),
  number: v.number(),
  questionBody: v.string(),
  questionId: v.id("questions"),
  sourceKey: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
  choices: v.array(publicChoiceValidator),
});

const publicTryoutSectionValidator = v.object({
  description: v.optional(v.string()),
  publicPath: v.string(),
  questionCount: v.number(),
  sectionKey: tryoutRouteKeyValidator,
  title: v.string(),
});

/** Lists active try-out countries for the localized hub page. */
export const listCountries = query({
  args: {
    locale: localeValidator,
  },
  returns: v.array(
    v.object({
      countryKey: tryoutRouteKeyValidator,
      description: v.optional(v.string()),
      publicPath: v.string(),
      title: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const countries = await ctx.db
      .query("tryoutCountries")
      .withIndex("by_locale_and_isActive_and_order", (q) =>
        q.eq("locale", args.locale).eq("isActive", true)
      )
      .take(CATALOG_PAGE_LIMIT);

    return countries.map((country) => ({
      countryKey: country.countryKey,
      description: country.description,
      publicPath: country.publicPath,
      title: country.title,
    }));
  },
});

/** Lists active exam families for one try-out country. */
export const listExams = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.array(
    v.object({
      description: v.optional(v.string()),
      examKey: tryoutRouteKeyValidator,
      publicPath: v.string(),
      scoringStrategy: tryoutScoringStrategyValidator,
      title: v.string(),
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
      return [];
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

    return exams.map((exam) => ({
      description: exam.description,
      examKey: exam.examKey,
      publicPath: exam.publicPath,
      scoringStrategy: exam.scoringStrategy,
      title: exam.title,
    }));
  },
});

/** Lists active sets for one country and exam family. */
export const listSets = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.array(
    v.object({
      description: v.optional(v.string()),
      publicPath: v.string(),
      scoringStrategy: tryoutScoringStrategyValidator,
      sectionCount: v.number(),
      setKey: tryoutRouteKeyValidator,
      title: v.string(),
      totalQuestionCount: v.number(),
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
      return [];
    }

    const sets = await ctx.db
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
      .take(CATALOG_PAGE_LIMIT);

    return sets.map((set) => ({
      description: set.description,
      publicPath: set.publicPath,
      scoringStrategy: set.scoringStrategy,
      sectionCount: set.sectionCount,
      setKey: set.setKey,
      title: set.title,
      totalQuestionCount: set.totalQuestionCount,
    }));
  },
});

/** Reads one try-out set and its ordered sections. */
export const getSet = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      set: v.object({
        countryKey: tryoutRouteKeyValidator,
        description: v.optional(v.string()),
        examKey: tryoutRouteKeyValidator,
        publicPath: v.string(),
        scoringStrategy: tryoutScoringStrategyValidator,
        sectionCount: v.number(),
        setKey: tryoutRouteKeyValidator,
        title: v.string(),
        totalQuestionCount: v.number(),
      }),
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

    const sections = await ctx.db
      .query("tryoutSections")
      .withIndex("by_tryoutSetId_and_order", (q) =>
        q.eq("tryoutSetId", set._id)
      )
      .take(set.sectionCount + 1);

    if (sections.length > set.sectionCount) {
      throw new ConvexError({
        code: "TRYOUT_SECTION_COUNT_EXCEEDED",
        message: "Try-out set has more sections than its snapshot count.",
      });
    }

    return {
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
        title: section.title,
      })),
    };
  },
});

/** Reads the public question payload for one try-out section. */
export const getSection = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      questions: v.array(publicQuestionValidator),
      section: publicTryoutSectionValidator,
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

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_questionSetId_and_number", (q) =>
        q.eq("questionSetId", section.questionSetId)
      )
      .take(section.questionCount + 1);

    if (questions.length > section.questionCount) {
      throw new ConvexError({
        code: "TRYOUT_QUESTION_COUNT_EXCEEDED",
        message: "Try-out section has more questions than its snapshot count.",
      });
    }

    const questionPayloads: PublicQuestionPayload[] = [];

    for (const question of questions) {
      const choices = await ctx.db
        .query("questionChoices")
        .withIndex("by_questionId_and_locale", (q) =>
          q.eq("questionId", question._id).eq("locale", args.locale)
        )
        .take(CHOICE_LIMIT_PER_QUESTION);

      questionPayloads.push({
        choices: choices.map((choice) => ({
          label: choice.label,
          optionKey: choice.optionKey,
          order: choice.order,
        })),
        contentHash: question.contentHash,
        number: question.number,
        questionBody: question.questionBody,
        questionId: question._id,
        sourceKey: question.sourceKey,
        sourceRevision: question.sourceRevision,
        title: question.title,
      });
    }

    return {
      questions: questionPayloads,
      section: {
        description: section.description,
        publicPath: section.publicPath,
        questionCount: section.questionCount,
        sectionKey: section.sectionKey,
        title: section.title,
      },
    };
  },
});
