import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  questionSets: defineTable({
    countryKey: v.string(),
    examKey: v.string(),
    setKey: v.string(),
    sectionKey: v.string(),
    locale: localeValidator,
    sourcePath: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    questionCount: v.number(),
    sourceRevision: v.string(),
    contentHash: v.string(),
    syncedAt: v.number(),
  })
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
    .index("by_countryKey_and_examKey_and_setKey_and_sectionKey_and_locale", [
      "countryKey",
      "examKey",
      "setKey",
      "sectionKey",
      "locale",
    ]),

  questions: defineTable({
    questionSetId: v.id("questionSets"),
    locale: localeValidator,
    sourceKey: v.string(),
    sourcePath: v.string(),
    sourceRevision: v.string(),
    number: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    questionBody: v.string(),
    answerBody: v.string(),
    contentHash: v.string(),
    syncedAt: v.number(),
  })
    .index("by_questionSetId_and_number", ["questionSetId", "number"])
    .index("by_locale_and_sourcePath", ["locale", "sourcePath"])
    .index("by_sourceKey_and_locale_and_sourceRevision", [
      "sourceKey",
      "locale",
      "sourceRevision",
    ]),

  questionChoices: defineTable({
    questionId: v.id("questions"),
    locale: localeValidator,
    optionKey: v.string(),
    label: v.string(),
    isCorrect: v.boolean(),
    order: v.number(),
  }).index("by_questionId_and_locale", ["questionId", "locale"]),
};

export default tables;
