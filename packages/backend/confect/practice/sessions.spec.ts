import { FunctionSpec, GroupSpec } from "@confect/core";
import { ContentDocumentSchema } from "@nakafa/aksara-contracts/assessment/document";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Grade } from "@repo/backend/confect/assessment/grade";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Verdict } from "@repo/backend/confect/assessment/verdict";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutResponseUnfitError } from "@repo/backend/confect/tryouts/response/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";

/** Why a practice request was refused: a session or question that is not the caller's, a checked question, or a freeze that failed. */
export class PracticeError extends Schema.TaggedError<
  PracticeError,
  { readonly brand: unique symbol }
>()("PracticeError", {
  code: Schema.Literals([
    "PRACTICE_CHECKED",
    "PRACTICE_MISSING",
    "PRACTICE_START_FAILED",
  ]),
  message: Schema.String,
}) {}

/** The section of a set that a learner practises, and the locale its questions are read in. */
const practiceTargetValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: appLocaleValidator,
  sectionKey: tryoutRouteKeyValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});
export type PracticeTarget = typeof practiceTargetValidator.Type;

/** A practice session's questions as the learner works through them: each one's place and its checked answer. */
const practiceStateValidator = Schema.Struct({
  questions: Schema.Array(
    Schema.Struct({
      answer: Schema.NullOr(
        Schema.Struct({
          checkedAt: Schema.Finite,
          grade: Grade,
          response: ExamResponse,
        })
      ),
      questionId: IdSchema("practiceQuestions"),
      questionOrder: Schema.Finite,
    })
  ),
  sessionId: IdSchema("practiceSessions"),
});

/** The bodies of a session's questions without their keys, which a page reads once (`readQuestionBody`). */
const practiceContentValidator = Schema.Array(
  Schema.Struct({
    body: Schema.String,
    questionId: IdSchema("practiceQuestions"),
    versionHash: Sha256HashSchema,
  })
);

/** A checked question's key and explanation, for a reader who may read them. */
const practiceExplanationValidator = Schema.Struct({
  explanation: Schema.optionalKey(ContentDocumentSchema),
  key: InteractionKeySchema,
});

const refusals = () =>
  Schema.Union([
    AuthFailure,
    PracticeError,
    ReleaseError,
    TryoutResponseUnfitError,
  ]);

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => practiceTargetValidator.fields,
      returns: () => Schema.Struct({ sessionId: IdSchema("practiceSessions") }),
      error: refusals,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "restart",
      args: () => ({ sessionId: IdSchema("practiceSessions") }),
      returns: () => Schema.Struct({ sessionId: IdSchema("practiceSessions") }),
      error: refusals,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "check",
      args: () => ({
        questionId: IdSchema("practiceQuestions"),
        response: ExamResponse,
      }),
      returns: () => Schema.Struct({ verdict: Verdict }),
      error: refusals,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "state",
      args: () => practiceTargetValidator.fields,
      returns: () => Schema.NullOr(practiceStateValidator),
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "content",
      args: () => ({
        locale: appLocaleValidator,
        sessionId: IdSchema("practiceSessions"),
      }),
      returns: () => practiceContentValidator,
      error: () => Schema.Union([AuthFailure, PracticeError, ReleaseError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "explain",
      args: () => ({
        locale: appLocaleValidator,
        questionId: IdSchema("practiceQuestions"),
      }),
      returns: () => Schema.NullOr(practiceExplanationValidator),
      error: () => Schema.Union([AuthFailure, ReleaseError]),
    }).middleware(Session)
  );
