import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

const renderableExerciseChoiceValidator = v.object({
  label: v.string(),
  value: v.boolean(),
});

const renderableExerciseChoicesValidator = v.object({
  id: v.array(renderableExerciseChoiceValidator),
  en: v.array(renderableExerciseChoiceValidator),
});

export const renderableRowsBySlugArgsValidator = {
  locale: localeValidator,
  slug: v.string(),
};

export const renderableRowsBySlugReturnValidator = nullable(
  v.array(
    v.object({
      choices: renderableExerciseChoicesValidator,
      number: v.number(),
    })
  )
);

export const questionAnswerSheetReturnValidator = v.array(
  v.object({
    exerciseNumber: v.number(),
    options: v.array(
      v.object({
        optionKey: v.string(),
        order: v.number(),
      })
    ),
    questionId: vv.id("exerciseQuestions"),
  })
);

export const exerciseSetIntegrityErrorCode = "EXERCISE_SET_INTEGRITY_ERROR";
