import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  publicTryoutExamValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/confect/tryouts/queries/catalogModel";
import {
  tryoutRouteKeyValidator,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
import {
  tryoutRuntimeStateValidator,
  tryoutSectionContentAccessValidator,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema } from "effect";

/** Asks for the learner's current attempt on the set a public URL names. */
export const currentSetRequestValidator = Schema.Struct({
  kind: Schema.Literal("current"),
  ...tryoutSetIdentityValidator.fields,
});
const retainedRequestFields = {
  attemptId: Schema.String,
  kind: Schema.Literal("retained"),
  locale: appLocaleValidator,
  publicPath: Schema.String,
};
const retainedSetRequestValidator = Schema.Struct(retainedRequestFields);
export const tryoutSetAttemptPageRequestValidator = Schema.Union([
  currentSetRequestValidator,
  retainedSetRequestValidator,
]);
export type TryoutSetAttemptPageRequest =
  typeof tryoutSetAttemptPageRequestValidator.Type;
/** Asks for the learner's current attempt through the section a public URL names. */
export const currentSectionRequestValidator = Schema.Struct({
  kind: Schema.Literal("current"),
  sectionKey: tryoutRouteKeyValidator,
  ...tryoutSetIdentityValidator.fields,
});
const retainedSectionRequestValidator = Schema.Struct(retainedRequestFields);
export const tryoutSectionAttemptPageRequestValidator = Schema.Union([
  currentSectionRequestValidator,
  retainedSectionRequestValidator,
]);
export type TryoutSectionAttemptPageRequest =
  typeof tryoutSectionAttemptPageRequestValidator.Type;
const setPageValidator = Schema.Struct({
  exam: publicTryoutExamValidator,
  entrySection: Schema.Union([publicTryoutSectionValidator, Schema.Null]),
  set: publicTryoutSetValidator,
  sections: Schema.mutable(Schema.Array(publicTryoutSectionValidator)),
  track: publicTryoutTrackValidator,
});
const sectionPageValidator = Schema.Struct({
  exam: publicTryoutExamValidator,
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
});
export const redirectResultValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  kind: Schema.Literal("redirect"),
  publicPath: Schema.String,
});
const restartTargetValidator = Schema.Union([
  Schema.Struct({
    entrySection: publicTryoutSectionValidator,
    setPublicPath: Schema.String,
  }),
  Schema.Null,
]);
const setPageResultFields = {
  attemptId: IdSchema("tryoutAttempts"),
  content: tryoutSectionContentAccessValidator,
  initialState: tryoutRuntimeStateValidator,
  page: setPageValidator,
  restartTarget: restartTargetValidator,
};
export const currentSetResultValidator = Schema.Struct({
  kind: Schema.Literal("current"),
  ...setPageResultFields,
});
export const retainedSetResultValidator = Schema.Struct({
  kind: Schema.Literal("retained"),
  ...setPageResultFields,
});
export const tryoutSetAttemptPageResultValidator = Schema.Union([
  Schema.Null,
  redirectResultValidator,
  currentSetResultValidator,
  retainedSetResultValidator,
]);
export type TryoutSetAttemptPageResult =
  typeof tryoutSetAttemptPageResultValidator.Type;
export const retainedSectionResultValidator = Schema.Struct({
  activeSectionPublicPath: Schema.Union([Schema.String, Schema.Null]),
  activeSetPublicPath: Schema.Union([Schema.String, Schema.Null]),
  attemptId: IdSchema("tryoutAttempts"),
  content: tryoutSectionContentAccessValidator,
  initialState: tryoutRuntimeStateValidator,
  kind: Schema.Literal("retained"),
  page: sectionPageValidator,
});
export const tryoutSectionAttemptPageResultValidator = Schema.Union([
  Schema.Null,
  redirectResultValidator,
  retainedSectionResultValidator,
]);
export type TryoutSectionAttemptPageResult =
  typeof tryoutSectionAttemptPageResultValidator.Type;
