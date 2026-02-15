import {
  articlePopularity,
  exercisePopularity,
  subjectPopularity,
} from "@repo/backend/convex/contents/aggregate";

/**
 * Trigger for articlePopularity table.
 * Maintains article popularity aggregate for trending features.
 */
export const articlePopularityTrigger = articlePopularity.trigger();

/**
 * Trigger for subjectPopularity table.
 * Maintains subject section popularity aggregate for trending features.
 */
export const subjectPopularityTrigger = subjectPopularity.trigger();

/**
 * Trigger for exercisePopularity table.
 * Maintains exercise set popularity aggregate for trending features.
 */
export const exercisePopularityTrigger = exercisePopularity.trigger();
