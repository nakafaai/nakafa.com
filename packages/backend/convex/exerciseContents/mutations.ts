import { internalMutation } from "@repo/backend/convex/functions";
import {
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/contentValidators";
import { v } from "convex/values";

/**
 * Upsert an exercise content document.
 * Creates if not exists, updates if contentHash changed.
 * Returns: { id, action: "created" | "updated" | "unchanged" }
 */
export const upsertExerciseContent = internalMutation({
  args: {
    locale: localeValidator,
    slug: v.string(),
    category: exercisesCategoryValidator,
    type: exercisesTypeValidator,
    material: exercisesMaterialValidator,
    exerciseType: v.string(),
    setName: v.string(),
    number: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    questionBody: v.string(),
    answerBody: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("exerciseContents")
      .withIndex("locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first();

    if (existing) {
      if (existing.contentHash === args.contentHash) {
        return { id: existing._id, action: "unchanged" as const };
      }

      await ctx.db.patch(existing._id, {
        category: args.category,
        type: args.type,
        material: args.material,
        exerciseType: args.exerciseType,
        setName: args.setName,
        number: args.number,
        title: args.title,
        description: args.description,
        date: args.date,
        questionBody: args.questionBody,
        answerBody: args.answerBody,
        contentHash: args.contentHash,
        syncedAt: now,
      });

      return { id: existing._id, action: "updated" as const };
    }

    const id = await ctx.db.insert("exerciseContents", {
      locale: args.locale,
      slug: args.slug,
      category: args.category,
      type: args.type,
      material: args.material,
      exerciseType: args.exerciseType,
      setName: args.setName,
      number: args.number,
      title: args.title,
      description: args.description,
      date: args.date,
      questionBody: args.questionBody,
      answerBody: args.answerBody,
      contentHash: args.contentHash,
      syncedAt: now,
    });

    return { id, action: "created" as const };
  },
});

/**
 * Sync exercise choices for a given exercise.
 * Deletes existing choices and inserts new ones.
 */
export const syncExerciseChoices = internalMutation({
  args: {
    exerciseId: v.id("exerciseContents"),
    locale: localeValidator,
    choices: v.array(
      v.object({
        optionKey: v.string(),
        label: v.string(),
        isCorrect: v.boolean(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("exerciseChoices")
      .withIndex("exerciseId_locale", (q) =>
        q.eq("exerciseId", args.exerciseId).eq("locale", args.locale)
      )
      .collect();

    for (const choice of existing) {
      await ctx.db.delete(choice._id);
    }

    for (const choice of args.choices) {
      await ctx.db.insert("exerciseChoices", {
        exerciseId: args.exerciseId,
        locale: args.locale,
        optionKey: choice.optionKey,
        label: choice.label,
        isCorrect: choice.isCorrect,
        order: choice.order,
      });
    }

    return { count: args.choices.length };
  },
});
