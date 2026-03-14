import {
  irtCalibrationStatusValidator,
  irtOperationalModelValidator,
} from "@repo/backend/convex/irt/schema";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

export const irtCalibratedItemValidator = v.object({
  questionId: vv.id("exerciseQuestions"),
  difficulty: v.number(),
  discrimination: v.number(),
  guessing: v.number(),
  responseCount: v.number(),
  correctRate: v.number(),
  calibrationStatus: irtCalibrationStatusValidator,
});

export const irtCalibrationResultValidator = v.object({
  model: irtOperationalModelValidator,
  attemptCount: v.number(),
  responseCount: v.number(),
  questionCount: v.number(),
  iterationCount: v.number(),
  maxParameterDelta: v.number(),
  items: v.array(irtCalibratedItemValidator),
});
