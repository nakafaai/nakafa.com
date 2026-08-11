import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  publicTryoutExamValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import {
  tryoutRouteKeyValidator,
  tryoutSetIdentityValidator,
} from "@repo/backend/convex/tryouts/route";
import { tryoutSectionContentAccessValidator } from "@repo/backend/convex/tryouts/runtime/content";
import { tryoutRuntimeStateValidator } from "@repo/backend/convex/tryouts/runtime/spec";
import { type Infer, v } from "convex/values";

const currentSetRequestValidator = v.object({
  kind: v.literal("current"),
  ...tryoutSetIdentityValidator.fields,
});

const retainedRequestFields = {
  attemptId: v.string(),
  kind: v.literal("retained"),
  locale: localeValidator,
  publicPath: v.string(),
};

const retainedSetRequestValidator = v.object(retainedRequestFields);

export const tryoutSetAttemptPageRequestValidator = v.union(
  currentSetRequestValidator,
  retainedSetRequestValidator
);

export type TryoutSetAttemptPageRequest = Infer<
  typeof tryoutSetAttemptPageRequestValidator
>;

const currentSectionRequestValidator = v.object({
  kind: v.literal("current"),
  sectionKey: tryoutRouteKeyValidator,
  ...tryoutSetIdentityValidator.fields,
});

const retainedSectionRequestValidator = v.object(retainedRequestFields);

export const tryoutSectionAttemptPageRequestValidator = v.union(
  currentSectionRequestValidator,
  retainedSectionRequestValidator
);

export type TryoutSectionAttemptPageRequest = Infer<
  typeof tryoutSectionAttemptPageRequestValidator
>;

const setPageValidator = v.object({
  exam: publicTryoutExamValidator,
  entrySection: v.union(publicTryoutSectionValidator, v.null()),
  set: publicTryoutSetValidator,
  sections: v.array(publicTryoutSectionValidator),
  track: publicTryoutTrackValidator,
});

const sectionPageValidator = v.object({
  exam: publicTryoutExamValidator,
  section: publicTryoutSectionValidator,
  set: publicTryoutSetValidator,
  track: publicTryoutTrackValidator,
});

const redirectResultValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  kind: v.literal("redirect"),
  publicPath: v.string(),
});

const restartTargetValidator = v.union(
  v.object({
    entrySection: publicTryoutSectionValidator,
    setPublicPath: v.string(),
  }),
  v.null()
);

const setPageResultFields = {
  attemptId: v.id("tryoutAttempts"),
  content: tryoutSectionContentAccessValidator,
  initialState: tryoutRuntimeStateValidator,
  page: setPageValidator,
  restartTarget: restartTargetValidator,
};

const currentSetResultValidator = v.object({
  kind: v.literal("current"),
  ...setPageResultFields,
});

const retainedSetResultValidator = v.object({
  kind: v.literal("retained"),
  ...setPageResultFields,
});

export const tryoutSetAttemptPageResultValidator = v.union(
  v.null(),
  redirectResultValidator,
  currentSetResultValidator,
  retainedSetResultValidator
);

export type TryoutSetAttemptPageResult = Infer<
  typeof tryoutSetAttemptPageResultValidator
>;

const retainedSectionResultValidator = v.object({
  activeSectionPublicPath: v.union(v.string(), v.null()),
  activeSetPublicPath: v.union(v.string(), v.null()),
  attemptId: v.id("tryoutAttempts"),
  content: tryoutSectionContentAccessValidator,
  initialState: tryoutRuntimeStateValidator,
  kind: v.literal("retained"),
  page: sectionPageValidator,
});

export const tryoutSectionAttemptPageResultValidator = v.union(
  v.null(),
  redirectResultValidator,
  retainedSectionResultValidator
);

export type TryoutSectionAttemptPageResult = Infer<
  typeof tryoutSectionAttemptPageResultValidator
>;
