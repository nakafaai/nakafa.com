import {
  AssessmentDocumentSchema,
  ContentDocumentSchema,
} from "@nakafa/aksara-contracts/assessment/document";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { EndReason } from "@repo/backend/confect/assessment/gate/end";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { Grade } from "@repo/backend/confect/assessment/grade";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoreResultValidator } from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";

const tryoutCurrentSectionValidator = Schema.Struct({
  answeredCount: Schema.Finite,
  completedAt: Schema.Union([Schema.Finite, Schema.Null]),
  endReason: Schema.Union([EndReason, Schema.Null]),
  expiresAt: Schema.Finite,
  /** The languages the section's questions are written in, the first being the one a learner starts in. */
  languages: Schema.NonEmptyArray(ContentLanguageSchema),
  /** The language the learner reads the section's questions in, which they may switch at any time. */
  questionLanguage: ContentLanguageSchema,
  score: Schema.Union([tryoutScoreResultValidator, Schema.Null]),
  sectionKey: tryoutRouteKeyValidator,
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
  totalQuestions: Schema.Finite,
});
const tryoutSectionScoreSummaryValidator = Schema.Struct({
  completedAt: Schema.Union([Schema.Finite, Schema.Null]),
  publishedScore: Schema.Finite,
  scoreStatus: tryoutScoreResultValidator.fields.scoreStatus,
  sectionKey: tryoutRouteKeyValidator,
  startedAt: Schema.Finite,
  totalCorrect: Schema.Finite,
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
  /** Published score of each scored section of this attempt. */
  sectionScores: Schema.mutable(
    Schema.Array(tryoutSectionScoreSummaryValidator)
  ),
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
});
const runtimeResponseValidator = Schema.Struct({
  answeredAt: Schema.Finite,
  /** How the answer graded, present only once answers may be reviewed. */
  grade: Schema.optionalKey(Grade),
  response: ExamResponse,
  updatedAt: Schema.Finite,
});
const runtimeQuestionValidator = Schema.Struct({
  /** Whether the learner flagged the question to come back to it, from the shared flags table (ADR 0031). */
  flagged: Schema.Boolean,
  placementId: IdSchema("tryoutAttemptPlacements"),
  questionOrder: Schema.Finite,
  response: Schema.Union([runtimeResponseValidator, Schema.Null]),
  /**
   * The version of the latest write of this question, which the next one must
   * exceed. It stays when the answer is cleared, and is absent before the first
   * write.
   */
  version: Schema.optionalKey(Version),
});
const tryoutSectionRuntimeValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  expiresAt: Schema.Finite,
  questions: Schema.mutable(Schema.Array(runtimeQuestionValidator)),
  section: tryoutCurrentSectionValidator,
});
export const tryoutRuntimeStateValidator = Schema.Struct({
  attempt: tryoutAttemptStateValidator,
  runtime: Schema.Union([Schema.Null, tryoutSectionRuntimeValidator]),
});
/**
 * One question of a section as the learner reads it in one language: the prompt of that language's item
 * version, its one interaction with its labels, and the document of the shared reading it was written
 * against. After its section finishes, a learner entitled to the answers also receives the key's answer
 * for the interaction, which accepts the typed answers of every language, and that version's
 * explanation in the app locale, when it has one.
 */
export const TryoutQuestionBodySchema = Schema.Struct({
  explanation: Schema.optionalKey(ContentDocumentSchema),
  interaction: InteractionSchema,
  key: Schema.optionalKey(InteractionKeySchema),
  prompt: AssessmentDocumentSchema,
  stimulus: Schema.optionalKey(ContentDocumentSchema),
});
export type TryoutQuestionBody = typeof TryoutQuestionBodySchema.Type;

/**
 * A question body as the JSON text the wire carries. A document can nest deeper than a Convex value
 * may, so a body crosses the wire as text and the page decodes it with the same schema.
 */
export const TryoutQuestionBodyText = Schema.fromJsonString(
  TryoutQuestionBodySchema
);

/**
 * One question on the wire: its placement and its body in each language of its section, in the
 * section's order, each with its item version and the body as JSON text. A page carries every language
 * once, so a learner who switches reads the other at once.
 */
const tryoutQuestionContentValidator = Schema.Struct({
  placementId: IdSchema("tryoutAttemptPlacements"),
  versions: Schema.mutable(
    Schema.NonEmptyArray(
      Schema.Struct({
        body: Schema.String,
        hash: Sha256HashSchema,
        language: ContentLanguageSchema,
      })
    )
  ),
});

/** The questions of one section that a learner may read now, in question order; none when it may read none. */
export const tryoutSectionContentValidator = Schema.mutable(
  Schema.Array(tryoutQuestionContentValidator)
);
export type TryoutSectionContent = typeof tryoutSectionContentValidator.Type;
