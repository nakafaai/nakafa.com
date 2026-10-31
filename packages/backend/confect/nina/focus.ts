import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  NinaFocus,
  NinaFocusInput,
  NinaFocusSource,
} from "@repo/backend/confect/nina/contract/focus";
import { formatFocusAnswer } from "@repo/backend/confect/nina/prompt/focus";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { isCorrectGrade } from "@repo/backend/confect/tryouts/response/answer";
import {
  readExplanation,
  readItemVersion,
} from "@repo/backend/confect/tryouts/rows";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import { readPlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import type { Locale } from "@repo/contents/content";
import { documentMarkdown } from "@repo/contents/llms/document";
import { Effect, Option } from "effect";

/** Verifies an explicitly requested question against a finished, entitled review. */
export const resolveQuestionFocus = Effect.fn("nina.focus.resolve")(function* (
  input: NinaFocusInput,
  userId: Docs["users"]["_id"]
) {
  const entitled = yield* readEntitledPlacement(input, userId);
  if (Option.isNone(entitled)) {
    return yield* new NinaTurnError({
      code: "NINA_CONTEXT_FAILED",
      message: "This try-out question is not available to Nina.",
    });
  }
  const { placement } = entitled.value;
  return {
    ...input,
    questionOrder: placement.questionOrder,
    sectionKey: placement.sectionKey,
  } satisfies NinaFocus;
});

/** Keeps a conversation's earlier question only while its review stays entitled. */
export const retainQuestionFocus = Effect.fn("nina.focus.retain")(function* (
  focus: NinaFocus | undefined,
  userId: Docs["users"]["_id"]
) {
  if (!focus) {
    return;
  }
  const entitled = yield* readEntitledPlacement(focus, userId);
  return Option.isSome(entitled) ? focus : undefined;
});

/** The words the prompt uses for how the learner's answer graded. */
function resultOf(
  response: Docs["tryoutResponses"] | null
): NinaFocusSource["result"] {
  if (response === null) {
    return "not answered";
  }
  if (response.grade.status === "pending") {
    return "answered, awaiting grading";
  }
  return isCorrectGrade(response.grade)
    ? "answered correctly"
    : "answered incorrectly";
}

/**
 * Reads the focused question, its explanation in the learner's locale, and the learner's answer, as
 * the text the prompt quotes. A version without an explanation in that locale quotes none.
 */
export const readQuestionFocus = Effect.fn("nina.focus.read")(function* (
  focus: NinaFocus,
  userId: Docs["users"]["_id"],
  locale: Locale
) {
  const entitled = yield* readEntitledPlacement(focus, userId);
  if (Option.isNone(entitled)) {
    return null;
  }
  const { placement } = entitled.value;
  const [version, question, explanation, response] = yield* Effect.all([
    readItemVersion(placement.versionHash),
    readPlacedQuestion(placement),
    readExplanation(placement.versionHash, locale),
    (yield* DatabaseReader)
      .table("tryoutResponses")
      .get("by_placementId", placement._id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
      ),
  ]);
  return {
    answer: formatFocusAnswer(question, response?.response ?? null),
    explanation: Option.match(explanation, {
      onNone: () => "",
      onSome: documentMarkdown,
    }),
    question: documentMarkdown(version.prompt),
    questionLanguage: placement.deliveryLanguage,
    questionOrder: placement.questionOrder,
    result: resultOf(response),
  } satisfies NinaFocusSource;
});

/** Answer access already requires a finished section and the Pro plan. */
const readEntitledPlacement = Effect.fn("nina.focus.placement")(function* (
  focus: NinaFocusInput,
  userId: Docs["users"]["_id"]
) {
  const attempt = yield* readOwnedAttemptById(focus.attemptId, userId);
  if (!attempt) {
    return Option.none();
  }
  const database = yield* DatabaseReader;
  const placement = yield* database
    .table("tryoutAttemptPlacements")
    .get(focus.placementId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (placement?.tryoutAttemptId !== attempt._id) {
    return Option.none();
  }
  const section = yield* database
    .table("tryoutSectionAttempts")
    .get("by_tryoutAttemptId_and_sectionKey", attempt._id, placement.sectionKey)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
  if (!section) {
    return Option.none();
  }
  const access = yield* readTryoutSectionContentAccess(attempt, section.status);
  return access.answers ? Option.some({ attempt, placement }) : Option.none();
});
