import { query } from "@repo/backend/convex/_generated/server";
import { getArticlePageImpl } from "@repo/backend/convex/contents/runtime/articles";
import {
  getExerciseGroupPageImpl,
  getExerciseQuestionPageImpl,
  getExerciseSetPageImpl,
} from "@repo/backend/convex/contents/runtime/exercises";
import {
  getArticlePageArgsValidator,
  getArticlePageReturnValidator,
  getExerciseGroupPageArgsValidator,
  getExerciseGroupPageReturnValidator,
  getExerciseQuestionPageArgsValidator,
  getExerciseQuestionPageReturnValidator,
  getExerciseSetPageArgsValidator,
  getExerciseSetPageReturnValidator,
  getSubjectPageArgsValidator,
  getSubjectPageReturnValidator,
} from "@repo/backend/convex/contents/runtime/spec";
import { getSubjectPageImpl } from "@repo/backend/convex/contents/runtime/subjects";

/**
 * Loads one published article page from the durable content read model.
 */
export const getArticlePage = query({
  args: getArticlePageArgsValidator,
  returns: getArticlePageReturnValidator,
  handler: getArticlePageImpl,
});

/**
 * Loads one published subject lesson from the durable content read model.
 */
export const getSubjectPage = query({
  args: getSubjectPageArgsValidator,
  returns: getSubjectPageReturnValidator,
  handler: getSubjectPageImpl,
});

/**
 * Loads one published exercise set from the durable content read model.
 */
export const getExerciseSetPage = query({
  args: getExerciseSetPageArgsValidator,
  returns: getExerciseSetPageReturnValidator,
  handler: getExerciseSetPageImpl,
});

/**
 * Loads one published exercise question from the durable content read model.
 */
export const getExerciseQuestionPage = query({
  args: getExerciseQuestionPageArgsValidator,
  returns: getExerciseQuestionPageReturnValidator,
  handler: getExerciseQuestionPageImpl,
});

/**
 * Loads one exercise group route from synced exercise set rows.
 */
export const getExerciseGroupPage = query({
  args: getExerciseGroupPageArgsValidator,
  returns: getExerciseGroupPageReturnValidator,
  handler: getExerciseGroupPageImpl,
});
