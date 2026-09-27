import {
  tryoutSectionVisibilityValidator,
  tryoutTrackKindValidator,
} from "@repo/backend/confect/tryouts/catalog/spec";
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
export const publicTryoutCountryWithExamCountValidator = Schema.Struct({
  ...publicTryoutCountryValidator.fields,
  examCount: Schema.Finite,
});
export const publicTryoutExamValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  examKey: tryoutRouteKeyValidator,
  publicPath: Schema.String,
  scoringStrategy: tryoutScoringStrategyValidator,
  title: Schema.String,
});
export const publicTryoutSetValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  description: Schema.optionalKey(Schema.String),
  examKey: tryoutRouteKeyValidator,
  publicPath: Schema.String,
  readyQuestionCount: Schema.Finite,
  readyVisibleSectionCount: Schema.Finite,
  scoringStrategy: tryoutScoringStrategyValidator,
  sectionCount: Schema.Finite,
  setKey: tryoutRouteKeyValidator,
  title: Schema.String,
  totalQuestionCount: Schema.Finite,
  trackKey: tryoutRouteKeyValidator,
  visibleSectionCount: Schema.Finite,
});
export const publicTryoutTrackValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
  readyQuestionCount: Schema.Finite,
  readySetCount: Schema.Finite,
  readyVisibleSectionCount: Schema.Finite,
  title: Schema.String,
  trackKey: tryoutRouteKeyValidator,
  trackKind: tryoutTrackKindValidator,
});
export const publicTryoutSectionValidator = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  publicPath: Schema.optionalKey(Schema.String),
  questionCount: Schema.Finite,
  sectionKey: tryoutRouteKeyValidator,
  timeLimitSeconds: Schema.Finite,
  title: Schema.String,
  visibility: tryoutSectionVisibilityValidator,
});
