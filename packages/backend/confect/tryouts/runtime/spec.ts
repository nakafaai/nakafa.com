import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { attemptEndReasonValidator } from "@repo/backend/confect/lib/attempts";
import {
  Outcome,
  RenderableSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoreResultValidator } from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export const tryoutCurrentSectionValidator = Schema.Struct({
  answeredCount: Schema.Finite,
  completedAt: Schema.Union([Schema.Finite, Schema.Null]),
  endReason: Schema.Union([attemptEndReasonValidator, Schema.Null]),
  expiresAt: Schema.Finite,
  score: Schema.Union([tryoutScoreResultValidator, Schema.Null]),
  sectionKey: tryoutRouteKeyValidator,
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
  totalQuestions: Schema.Finite,
});
export const tryoutAttemptStateValidator = Schema.Struct({
  activeSectionKey: Schema.Union([tryoutRouteKeyValidator, Schema.Null]),
  attemptId: IdSchema("tryoutAttempts"),
  attemptNumber: Schema.Finite,
  completedSectionKeys: Schema.mutable(Schema.Array(tryoutRouteKeyValidator)),
  expiresAt: Schema.Finite,
  resumeSectionPublicPath: Schema.Union([Schema.String, Schema.Null]),
  resumeSectionKey: Schema.Union([tryoutRouteKeyValidator, Schema.Null]),
  score: Schema.Union([tryoutScoreResultValidator, Schema.Null]),
  section: Schema.Union([tryoutCurrentSectionValidator, Schema.Null]),
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
});
const runtimeResponseValidator = Schema.Struct({
  answeredAt: Schema.Finite,
  isComplete: Schema.Boolean,
  /** How the answer scored, present only once answers may be reviewed. */
  outcome: Schema.optionalKey(Outcome),
  selection: Selection,
  updatedAt: Schema.Finite,
});
const runtimeQuestionValidator = Schema.Struct({
  contentHash: Schema.String,
  placementId: IdSchema("tryoutAttemptPlacements"),
  questionOrder: Schema.Finite,
  response: Schema.Union([runtimeResponseValidator, Schema.Null]),
  responseSpec: RenderableSpec,
  sourcePath: Schema.String,
  sourceRevision: Schema.String,
});
export const tryoutSectionRuntimeValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  expiresAt: Schema.Finite,
  questions: Schema.mutable(Schema.Array(runtimeQuestionValidator)),
  section: tryoutCurrentSectionValidator,
});
export const tryoutRuntimeStateValidator = Schema.Struct({
  attempt: tryoutAttemptStateValidator,
  runtime: Schema.Union([Schema.Null, tryoutSectionRuntimeValidator]),
});
export const selectorFields = {
  appLocale: appLocaleValidator,
  artifactHash: Schema.String,
  bundleHash: Schema.String,
  contentHash: Schema.String,
  contentKey: Schema.String,
  questionOrder: Schema.Finite,
  sectionKey: tryoutRouteKeyValidator,
  snapshotReleaseId: Schema.String,
  snapshotId: Schema.String,
  sourcePath: Schema.String,
  sourceRevision: Schema.String,
};
export const tryoutQuestionSelectorValidator = Schema.Struct({
  ...selectorFields,
  delivery: Schema.Literal("authenticated"),
});
export type TryoutQuestionSelector = Schema.Schema.Type<
  typeof tryoutQuestionSelectorValidator
>;
export const tryoutAnswerSelectorValidator = Schema.Struct({
  ...selectorFields,
  delivery: Schema.Literal("entitled"),
});
export type TryoutAnswerSelector = Schema.Schema.Type<
  typeof tryoutAnswerSelectorValidator
>;
export const tryoutSectionContentAccessValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("none"),
  }),
  Schema.Struct({
    answers: Schema.mutable(Schema.Array(tryoutAnswerSelectorValidator)),
    kind: Schema.Literal("signed"),
    /** Answers of the leading questions a free learner's review offer shows. */
    previewAnswers: Schema.mutable(Schema.Array(tryoutAnswerSelectorValidator)),
    questions: Schema.mutable(Schema.Array(tryoutQuestionSelectorValidator)),
  }),
]);
export type TryoutSectionContentAccess = Schema.Schema.Type<
  typeof tryoutSectionContentAccessValidator
>;
export const noTryoutSectionContentAccess = {
  kind: "none",
} satisfies TryoutSectionContentAccess;
