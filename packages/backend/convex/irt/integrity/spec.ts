import { v } from "convex/values";

export const calibrationCacheIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  missingStatsSetCount: v.number(),
  oversizedSetCount: v.number(),
});

export const scaleQualityIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  missingQualityCheckTryoutCount: v.number(),
  unstartableTryoutCount: v.number(),
});

export const calibrationQueueAttemptIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  duplicatePendingAttemptCount: v.number(),
  isDone: v.boolean(),
  missingPendingQueueAttemptCount: v.number(),
  staleAttemptQueueSetCount: v.number(),
});

export const calibrationQueueEntryIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  orphanedQueueEntryCount: v.number(),
  staleQueueEntryCount: v.number(),
});
