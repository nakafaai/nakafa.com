import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { decodeArtifactJson } from "@repo/backend/confect/contentRelease/parse";
import type {
  NinaFocus,
  NinaFocusInput,
  NinaFocusSource,
} from "@repo/backend/confect/nina/contract/focus";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";
import { readAttemptAnswer } from "@repo/backend/confect/tryouts/runtime/answer";
import { readTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/content";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import type { Locale } from "@repo/contents/content";
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

/** Reads the signed question, its localized explanation and the learner's answer. */
export const readQuestionFocus = Effect.fn("nina.focus.read")(function* (
  focus: NinaFocus,
  userId: Docs["users"]["_id"],
  locale: Locale
) {
  const entitled = yield* readEntitledPlacement(focus, userId);
  if (Option.isNone(entitled)) {
    return null;
  }
  const { attempt, placement } = entitled.value;
  const database = yield* DatabaseReader;
  const answer = yield* readAttemptAnswer(
    attempt,
    placement,
    AppLocaleSchema.make(locale)
  );
  const [question, explanation, response] = yield* Effect.all([
    readArtifact(placement.questionArtifactHash),
    readArtifact(answer.artifactHash),
    database
      .table("tryoutResponses")
      .get("by_placementId", placement._id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
      ),
  ]);
  return {
    questionOrder: placement.questionOrder,
    questionLocale: question.payload.artifactLocale,
    questionMdx: question.payload.rawMdx,
    explanationMdx: explanation.payload.rawMdx,
    responseSpec: placement.responseSpec,
    selection: response?.selection ?? null,
    outcome: response === null ? null : readOutcome(response),
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

/** Returns one stored signed body whose content address still matches. */
const readArtifact = Effect.fn("nina.focus.artifact")(function* (
  artifactHash: string
) {
  const stored = yield* (yield* DatabaseReader)
    .table("contentArtifacts")
    .get("by_artifactHash", artifactHash)
    .pipe(Effect.mapError(toTryoutRuntimeError));
  const artifact = yield* decodeArtifactJson(stored.artifactJson);
  if (artifact.artifactHash !== artifactHash) {
    return yield* toTryoutRuntimeError(
      "A focused try-out body changed its content address."
    );
  }
  return artifact;
});
