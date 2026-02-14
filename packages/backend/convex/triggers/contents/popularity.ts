import {
  articlePopularity,
  exercisePopularity,
  subjectPopularity,
} from "@repo/backend/convex/contents/aggregate";

/**
 * Aggregate popularity triggers for content view tables.
 *
 * These triggers maintain the popularity aggregates that power trending content features.
 * Each trigger automatically updates the aggregate when records are inserted/deleted
 * in the corresponding content view tables.
 */

/**
 * Trigger for articleContentViews table.
 * Maintains article popularity aggregate sorted by view count per locale.
 */
export const articlePopularityTrigger = articlePopularity.trigger();

/**
 * Trigger for subjectContentViews table.
 * Maintains subject section popularity aggregate sorted by view count per locale.
 */
export const subjectPopularityTrigger = subjectPopularity.trigger();

/**
 * Trigger for exerciseContentViews table.
 * Maintains exercise popularity aggregate sorted by view count per locale.
 */
export const exercisePopularityTrigger = exercisePopularity.trigger();
