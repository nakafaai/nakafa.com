import {
  learningPopularityFiniteWindowValues,
  learningPopularityScopeValues,
} from "@repo/backend/confect/contents/popularity";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export const invalidContentAnalyticsPartitionCode =
  "INVALID_CONTENT_ANALYTICS_PARTITION";
export const contentAnalyticsIoFailedCode = "CONTENT_ANALYTICS_IO_FAILED";
const learningPopularityWindowValidator = Schema.Literals([
  ...learningPopularityFiniteWindowValues,
]);
const learningPopularityScopeValidator = Schema.Literals([
  ...learningPopularityScopeValues,
]);
export const scheduleContentAnalyticsPartitionsResultValidator = Schema.Struct({
  enqueuedPartitions: Schema.Finite,
});
export const scheduleContentAnalyticsPartitionArgs = {
  partition: Schema.Finite,
};
export const scheduleContentAnalyticsPartitionArgsValidator = Schema.Struct(
  scheduleContentAnalyticsPartitionArgs
);
export const scheduleContentAnalyticsPartitionResultValidator = Schema.Struct({
  createdPartition: Schema.Boolean,
  scheduled: Schema.Boolean,
});
export const processContentAnalyticsPartitionArgs = {
  leaseVersion: Schema.Finite,
  partition: Schema.Finite,
};
export const processContentAnalyticsPartitionArgsValidator = Schema.Struct(
  processContentAnalyticsPartitionArgs
);
export const processContentAnalyticsPartitionResultValidator = Schema.Struct({
  hasMore: Schema.Boolean,
  partition: Schema.Finite,
  processed: Schema.Finite,
  skipped: Schema.Boolean,
});

/** Scheduler result returned after enqueueing popularity window refresh work. */
export const scheduleLearningPopularityRefreshesResultValidator = Schema.Struct(
  {
    scheduledWindows: Schema.Finite,
  }
);
export const scheduleLearningPopularityExpiriesResultValidator = Schema.Struct({
  expiryWindows: Schema.Finite,
  repairWindows: Schema.Finite,
  skippedWindows: Schema.Finite,
});
export const pruneLearningPopularityResultValidator = Schema.Struct({
  hasMore: Schema.Boolean,
  signalsDeleted: Schema.Finite,
  viewersDeleted: Schema.Finite,
  waitingForMaintenance: Schema.Boolean,
});
export const refreshLearningPopularityWindowPageArgs = {
  cursor: Schema.optionalKey(Schema.String),
  day: Schema.Finite,
  scopeMode: learningPopularityScopeValidator,
  windowKey: learningPopularityWindowValidator,
};

/** Public validator for one paginated popularity window refresh invocation. */
export const refreshLearningPopularityWindowPageArgsValidator = Schema.Struct(
  refreshLearningPopularityWindowPageArgs
);

/** Progress contract returned by a bounded popularity refresh page. */
export const refreshLearningPopularityWindowPageResultValidator = Schema.Struct(
  {
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    refreshedCounters: Schema.Finite,
    removedCounters: Schema.Finite,
    skipped: Schema.Boolean,
  }
);
export const expireLearningPopularityWindowPageArgs = {
  cursor: Schema.optionalKey(Schema.String),
  day: Schema.Finite,
  scopeMode: learningPopularityScopeValidator,
  windowKey: learningPopularityWindowValidator,
};
export const expireLearningPopularityWindowPageArgsValidator = Schema.Struct(
  expireLearningPopularityWindowPageArgs
);
export const expireLearningPopularityWindowPageResultValidator = Schema.Struct({
  continueCursor: Schema.String,
  expiredCounters: Schema.Finite,
  isDone: Schema.Boolean,
  removedCounters: Schema.Finite,
  repairedCounters: Schema.Finite,
  skipped: Schema.Boolean,
});
export type ScheduleContentAnalyticsPartitionArgs =
  typeof scheduleContentAnalyticsPartitionArgsValidator.Type;
export type ProcessContentAnalyticsPartitionArgs =
  typeof processContentAnalyticsPartitionArgsValidator.Type;
export type RefreshLearningPopularityWindowPageArgs =
  typeof refreshLearningPopularityWindowPageArgsValidator.Type;
export type ExpireLearningPopularityWindowPageArgs =
  typeof expireLearningPopularityWindowPageArgsValidator.Type;

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
