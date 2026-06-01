import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const invalidContentAnalyticsPartitionCode =
  "INVALID_CONTENT_ANALYTICS_PARTITION";
export const contentAnalyticsIoFailedCode = "CONTENT_ANALYTICS_IO_FAILED";

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
