import { internal } from "@repo/backend/convex/_generated/api";
import { CRON_CONFIG } from "@repo/backend/convex/audioStudies/constants";
import { cronJobs } from "convex/server";

const crons = cronJobs();

// Content aggregation cron - runs every 30 minutes
// Populates audioGenerationQueue with high-priority content from aggregate data
if (CRON_CONFIG.enabled && CRON_CONFIG.aggregatePopularity) {
  crons.interval(
    "aggregate content popularity",
    { minutes: 30 },
    internal.contents.mutations.aggregatePopularity,
    {}
  );
}

// Audio generation queue processing - runs every 5 minutes
// Starts workflows for pending queue items (respects daily limits)
if (CRON_CONFIG.enabled && CRON_CONFIG.processQueue) {
  crons.interval(
    "process audio generation queue",
    { minutes: 5 },
    internal.audioStudies.mutations.startWorkflowsForPendingItems,
    { maxItems: CRON_CONFIG.maxItemsPerProcess }
  );
}

// Audio generation cleanup - runs daily at 2 AM UTC
// Removes completed/failed queue items older than retention period
if (CRON_CONFIG.enabled && CRON_CONFIG.cleanup) {
  crons.cron(
    "cleanup audio generation",
    "0 2 * * *",
    internal.audioStudies.mutations.cleanup,
    {}
  );
}

export default crons;
