import type { AssessmentSource } from "@repo/contents/_types/assessment/schema";
import { AssessmentSourceSchema } from "@repo/contents/_types/assessment/schema";
import { snbtAssessment } from "@repo/contents/assessment/indonesia/snbt";
import { tkaAssessment } from "@repo/contents/assessment/indonesia/tka";
import { Schema } from "effect";

const assessmentSourceInput = [
  snbtAssessment,
  tkaAssessment,
] satisfies readonly AssessmentSource[];

/**
 * Source-controlled assessment registry.
 *
 * Assessment rows own exam structure and map that structure to reusable
 * material keys. Material source files own localized learner assets; they do
 * not decide which assessment includes a route.
 */
export const ASSESSMENT_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(AssessmentSourceSchema)
)(assessmentSourceInput);
