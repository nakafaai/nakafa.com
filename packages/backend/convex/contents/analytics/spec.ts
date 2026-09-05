import {
  learningPopularityFiniteWindowValues,
  learningPopularityScopeValues,
} from "@repo/backend/convex/contents/popularity";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Schema } from "effect";

export const invalidContentAnalyticsPartitionCode =
  "INVALID_CONTENT_ANALYTICS_PARTITION";
export const contentAnalyticsIoFailedCode = "CONTENT_ANALYTICS_IO_FAILED";

const learningPopularityWindowValidator = literals(
  ...learningPopularityFiniteWindowValues
);
const learningPopularityScopeValidator = literals(
  ...learningPopularityScopeValues
);
export const scheduleContentAnalyticsPartitionsResultValidator = v.object({
  enqueuedPartitions: v.number(),
});

export const scheduleContentAnalyticsPartitionArgs = {
  partition: v.number(),
};

export const scheduleContentAnalyticsPartitionArgsValidator = v.object(
  scheduleContentAnalyticsPartitionArgs
);

export const scheduleContentAnalyticsPartitionResultValidator = v.object({
  createdPartition: v.boolean(),
  scheduled: v.boolean(),
});

export const processContentAnalyticsPartitionArgs = {
  leaseVersion: v.number(),
  partition: v.number(),
};

export const processContentAnalyticsPartitionArgsValidator = v.object(
  processContentAnalyticsPartitionArgs
);

export const processContentAnalyticsPartitionResultValidator = v.object({
  hasMore: v.boolean(),
  partition: v.number(),
  processed: v.number(),
  skipped: v.boolean(),
});

/** Scheduler result returned after enqueueing popularity window refresh work. */
export const scheduleLearningPopularityRefreshesResultValidator = v.object({
  scheduledWindows: v.number(),
});

export const scheduleLearningPopularityExpiriesResultValidator = v.object({
  expiryWindows: v.number(),
  repairWindows: v.number(),
  skippedWindows: v.number(),
});

export const refreshLearningPopularityWindowPageArgs = {
  cursor: v.optional(v.string()),
  day: v.number(),
  scopeMode: learningPopularityScopeValidator,
  windowKey: learningPopularityWindowValidator,
};

/** Public validator for one paginated popularity window refresh invocation. */
export const refreshLearningPopularityWindowPageArgsValidator = v.object(
  refreshLearningPopularityWindowPageArgs
);

/** Progress contract returned by a bounded popularity refresh page. */
export const refreshLearningPopularityWindowPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  refreshedCounters: v.number(),
  removedCounters: v.number(),
  skipped: v.boolean(),
});

export const expireLearningPopularityWindowPageArgs = {
  cursor: v.optional(v.string()),
  day: v.number(),
  scopeMode: learningPopularityScopeValidator,
  windowKey: learningPopularityWindowValidator,
};

export const expireLearningPopularityWindowPageArgsValidator = v.object(
  expireLearningPopularityWindowPageArgs
);

export const expireLearningPopularityWindowPageResultValidator = v.object({
  continueCursor: v.string(),
  expiredCounters: v.number(),
  isDone: v.boolean(),
  removedCounters: v.number(),
  repairedCounters: v.number(),
  skipped: v.boolean(),
});

export const sweepLearningPopularityRetentionArgs = {
  day: v.number(),
};

export const sweepLearningPopularityRetentionArgsValidator = v.object(
  sweepLearningPopularityRetentionArgs
);

export const sweepLearningPopularityRetentionResultValidator = v.object({
  deleted: v.number(),
  done: v.boolean(),
  skipped: v.boolean(),
});

export type ScheduleContentAnalyticsPartitionArgs = Infer<
  typeof scheduleContentAnalyticsPartitionArgsValidator
>;

export type ScheduleContentAnalyticsPartitionsResult = Infer<
  typeof scheduleContentAnalyticsPartitionsResultValidator
>;

export type ScheduleContentAnalyticsPartitionResult = Infer<
  typeof scheduleContentAnalyticsPartitionResultValidator
>;

export type ProcessContentAnalyticsPartitionArgs = Infer<
  typeof processContentAnalyticsPartitionArgsValidator
>;

export type ProcessContentAnalyticsPartitionResult = Infer<
  typeof processContentAnalyticsPartitionResultValidator
>;

export type ScheduleLearningPopularityRefreshesResult = Infer<
  typeof scheduleLearningPopularityRefreshesResultValidator
>;

export type ScheduleLearningPopularityExpiriesResult = Infer<
  typeof scheduleLearningPopularityExpiriesResultValidator
>;

export type RefreshLearningPopularityWindowPageArgs = Infer<
  typeof refreshLearningPopularityWindowPageArgsValidator
>;

export type RefreshLearningPopularityWindowPageResult = Infer<
  typeof refreshLearningPopularityWindowPageResultValidator
>;

export type ExpireLearningPopularityWindowPageArgs = Infer<
  typeof expireLearningPopularityWindowPageArgsValidator
>;

export type ExpireLearningPopularityWindowPageResult = Infer<
  typeof expireLearningPopularityWindowPageResultValidator
>;

export type SweepLearningPopularityRetentionArgs = Infer<
  typeof sweepLearningPopularityRetentionArgsValidator
>;

export type SweepLearningPopularityRetentionResult = Infer<
  typeof sweepLearningPopularityRetentionResultValidator
>;

/** Raised when a requested analytics partition is outside the configured set. */
export class InvalidContentAnalyticsPartitionError extends Schema.TaggedError<InvalidContentAnalyticsPartitionError>()(
  "InvalidContentAnalyticsPartitionError",
  {
    code: Schema.Literal(invalidContentAnalyticsPartitionCode),
    message: Schema.String,
  }
) {}

/** Raised when Convex IO fails while leasing or draining content analytics. */
export class ContentAnalyticsIoError extends Schema.TaggedError<ContentAnalyticsIoError>()(
  "ContentAnalyticsIoError",
  {
    code: Schema.Literal(contentAnalyticsIoFailedCode),
    message: Schema.String,
  }
) {}

/** Maps thrown Convex IO failures into the analytics domain error channel. */
export function toContentAnalyticsIoError(error: unknown) {
  return new ContentAnalyticsIoError({
    code: contentAnalyticsIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}
