import { ConvexError } from "convex/values";

/** Validate that scheduled assessments always include a publish timestamp. */
export function validateScheduledStatus(status: string, scheduledAt?: number) {
  if (status === "scheduled" && !scheduledAt) {
    throw new ConvexError({
      code: "INVALID_ASSESSMENT_STATUS",
      message: "Scheduled assessments require a publish timestamp.",
    });
  }
}
