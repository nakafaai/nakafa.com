import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";

/**
 * One section of an attempt, frozen when it starts: its key and order and its public path from the
 * catalog, its question count from the paper's places, and its time limit from the profile's template.
 */
export const tryoutSectionValidator = Schema.Struct({
  publicPath: Schema.optionalKey(Schema.String),
  questionCount: Schema.Finite,
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: Schema.Finite,
  timeLimitSeconds: Schema.Finite,
});
export type TryoutSection = typeof tryoutSectionValidator.Type;
