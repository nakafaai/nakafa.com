import { ConvexError } from "convex/values";

/**
 * Validates that scheduledAt is provided and in the future when status is "scheduled".
 * Throws ConvexError if validation fails.
 */
export function validateScheduledStatus(
  status: string,
  scheduledAt: number | undefined
) {
  if (status !== "scheduled") {
    return;
  }
  if (!scheduledAt) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "scheduledAt is required when status is scheduled.",
    });
  }
  if (scheduledAt <= Date.now()) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "scheduledAt must be in the future.",
    });
  }
}
