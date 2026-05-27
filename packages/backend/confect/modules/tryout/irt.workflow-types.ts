import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { RegisteredMutation } from "convex/server";

export type CalibrateSetTwoPLWorkflow = RegisteredMutation<
  "internal",
  {
    readonly calibrationRunId: Id<"irtCalibrationRuns">;
    readonly setId: Id<"exerciseSets">;
  },
  null
>;
