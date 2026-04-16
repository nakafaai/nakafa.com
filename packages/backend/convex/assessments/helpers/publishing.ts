import type { AssessmentStatus } from "@repo/backend/convex/assessments/schema";
import { ConvexError } from "convex/values";

/** Validate that scheduled assessments always include a future publish timestamp. */
export function validateScheduledStatus(
  status: AssessmentStatus,
  scheduledAt?: number
) {
  if (status !== "scheduled") {
    return;
  }

  if (!scheduledAt) {
    throw new ConvexError({
      code: "INVALID_ASSESSMENT_STATUS",
      message: "Scheduled assessments require a publish timestamp.",
    });
  }

  if (scheduledAt <= Date.now()) {
    throw new ConvexError({
      code: "INVALID_ASSESSMENT_STATUS",
      message: "Scheduled assessments require a future publish timestamp.",
    });
  }
}
