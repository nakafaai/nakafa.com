import {
  GroupAxisSchema,
  SectionVisibilitySchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoringStrategyValidator } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";
export const publicTryoutCountryValidator = Schema.Struct({
  countryCode: Schema.String,
  countryKey: tryoutRouteKeyValidator,
  description: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
  title: Schema.String,
});
export const publicTryoutExamValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  examKey: tryoutRouteKeyValidator,
  groupAxis: GroupAxisSchema,
  publicPath: Schema.String,
  title: Schema.String,
});
/**
 * An exam of the hub or a country page, with its entry: where a link to the exam
 * lands, its first group's entry (`readPublishedGroupEntry`).
 */
export const publicTryoutCountryExamValidator = Schema.Struct({
  ...publicTryoutExamValidator.fields,
  entryPath: Schema.String,
});
/** A country of the hub with its exams in order, which the hub shows as cards. */
export const publicTryoutHubCountryValidator = Schema.Struct({
  ...publicTryoutCountryValidator.fields,
  exams: Schema.Array(publicTryoutCountryExamValidator),
});
export const publicTryoutGroupValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  groupKey: tryoutRouteKeyValidator,
  publicPath: Schema.String,
  title: Schema.String,
});
/** A group that a page's group selector offers, with its entry, where choosing it lands. */
export const publicTryoutGroupChoiceValidator = Schema.Struct({
  ...publicTryoutGroupValidator.fields,
  entryPath: Schema.String,
});
export const publicTryoutSetValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  description: Schema.optionalKey(Schema.String),
  examKey: tryoutRouteKeyValidator,
  publicPath: Schema.String,
  questionCount: Schema.Finite,
  scoringStrategy: tryoutScoringStrategyValidator,
  sectionCount: Schema.Finite,
  setKey: tryoutRouteKeyValidator,
  title: Schema.String,
  trackKey: tryoutRouteKeyValidator,
  visibleSectionCount: Schema.Finite,
});
export const publicTryoutTrackValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  groupKey: tryoutRouteKeyValidator,
  publicPath: Schema.String,
  title: Schema.String,
  trackKey: tryoutRouteKeyValidator,
});
export const publicTryoutSectionValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  publicPath: Schema.optionalKey(Schema.String),
  questionCount: Schema.Finite,
  sectionKey: tryoutRouteKeyValidator,
  timeLimitSeconds: Schema.Finite,
  title: Schema.String,
  visibility: SectionVisibilitySchema,
});
