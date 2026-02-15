import {
  articlePopularity,
  exercisePopularity,
  subjectPopularity,
} from "@repo/backend/convex/contents/aggregate";

/** Trigger for maintaining article popularity aggregate. */
export const articlePopularityTrigger = articlePopularity.trigger();

/** Trigger for maintaining subject section popularity aggregate. */
export const subjectPopularityTrigger = subjectPopularity.trigger();

/** Trigger for maintaining exercise set popularity aggregate. */
export const exercisePopularityTrigger = exercisePopularity.trigger();
