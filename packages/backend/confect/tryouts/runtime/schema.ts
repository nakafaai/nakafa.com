import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";

/**
 * One section of an attempt, frozen when it starts: its key and order and its public path from the
 * catalog, its question count and the languages its questions are written in from the paper, the first
 * being the one a learner starts in, and its time limit from the profile's template.
 */
export const tryoutSectionValidator = Schema.Struct({
  languages: Schema.mutable(Schema.NonEmptyArray(ContentLanguageSchema)),
  publicPath: Schema.optionalKey(Schema.String),
  questionCount: Schema.Finite,
  sectionKey: tryoutRouteKeyValidator,
  sectionOrder: Schema.Finite,
  timeLimitSeconds: Schema.Finite,
});
export type TryoutSection = typeof tryoutSectionValidator.Type;
