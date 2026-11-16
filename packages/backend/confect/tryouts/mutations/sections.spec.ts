import { FunctionSpec, GroupSpec } from "@confect/core";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  TryoutProgressError,
  TryoutProgressSizeError,
} from "@repo/backend/confect/tryouts/progress/spec";
import {
  TryoutResponseIntegrityError,
  TryoutResponseUnfitError,
} from "@repo/backend/confect/tryouts/response/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";
export const SECTION_COMPLETED_RESULT = "completed";
const SECTION_STARTED_RESULT = "started";

/** The one section of one attempt that a start or a finish targets. */
const sectionTargetValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  sectionKey: tryoutRouteKeyValidator,
});
export type SectionTarget = typeof sectionTargetValidator.Type;

/**
 * A start of one section: its target and the question language the learner confirmed on the section
 * page. A start without one, as a set's own page makes, opens on the learner's working language for
 * the exam, else on the section's first language.
 */
const sectionStartValidator = Schema.Struct({
  ...sectionTargetValidator.fields,
  questionLanguage: Schema.optionalKey(ContentLanguageSchema),
});
export type SectionStart = typeof sectionStartValidator.Type;

/** A switch of the language one section's questions show in, while it runs or in its review. */
const languageChoiceValidator = Schema.Struct({
  ...sectionTargetValidator.fields,
  language: ContentLanguageSchema,
});

/** A look at one question in another language of its section, which only analytics counts. */
const lookValidator = Schema.Struct({
  from: ContentLanguageSchema,
  placementId: IdSchema("tryoutAttemptPlacements"),
  to: ContentLanguageSchema,
});
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "start",
      args: () => sectionStartValidator.fields,
      returns: () =>
        Schema.Struct({
          kind: Schema.Literal(SECTION_STARTED_RESULT),
        }),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseUnfitError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "complete",
      args: () => sectionTargetValidator.fields,
      returns: () =>
        Schema.Struct({
          kind: Schema.Literal(SECTION_COMPLETED_RESULT),
        }),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseUnfitError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "chooseQuestionLanguage",
      args: () => languageChoiceValidator.fields,
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "countQuestionLook",
      args: () => lookValidator.fields,
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, TryoutRuntimeErrorWire]),
    }).middleware(Session)
  );
