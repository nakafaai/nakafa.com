"use client";
import { api } from "@repo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TryoutSelectableChoice } from "@/components/tryout/runtime/choice-surface.client";
import type {
  TryoutRuntimeChoice,
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";
import { reportClientException } from "@/lib/analytics/client";

type SaveResponseArgs = FunctionArgs<
  typeof api.tryouts.mutations.responses.save
>;
interface TryoutChoicesValue {
  locked: boolean;
  question: TryoutRuntimeQuestion;
}
/** Renders and saves selectable answers for one runtime question. */
export function TryoutChoices({ value }: { value: TryoutChoicesValue }) {
  const { locked, question } = value;
  const saveResponse = useMutation(
    api.tryouts.mutations.responses.save
  ).withOptimisticUpdate((localStore, args) => {
    const sectionQueries = localStore.getAllQueries(
      api.tryouts.queries.runtime.getSectionAttemptState
    );
    for (const sectionQuery of sectionQueries) {
      const state = sectionQuery.value;
      const runtime = state?.runtime;
      if (!runtime) {
        continue;
      }
      const nextRuntime = applyOptimisticResponse(runtime, args);
      if (nextRuntime) {
        localStore.setQuery(
          api.tryouts.queries.runtime.getSectionAttemptState,
          sectionQuery.args,
          { ...state, runtime: nextRuntime }
        );
      }
    }
    const setQueries = localStore.getAllQueries(
      api.tryouts.queries.runtime.getSetAttemptState
    );
    for (const setQuery of setQueries) {
      const state = setQuery.value;
      const runtime = state?.runtime;
      if (!runtime) {
        continue;
      }
      const nextRuntime = applyOptimisticResponse(runtime, args);
      if (nextRuntime) {
        localStore.setQuery(
          api.tryouts.queries.runtime.getSetAttemptState,
          setQuery.args,
          { ...state, runtime: nextRuntime }
        );
      }
    }
  });
  const tExercises = useTranslations("Exercises");
  /** Saves one selected choice while Convex owns elapsed-time accounting. */
  function saveChoice(choice: TryoutRuntimeChoice) {
    if (locked) {
      return;
    }
    const saveRequest = saveResponse({
      placementId: question.placementId,
      selectedOptionId: choice.optionKey,
    });
    Effect.runPromise(
      Effect.tryPromise(() => saveRequest).pipe(
        Effect.catchTag("UnknownError", ({ cause: error }) =>
          handleSubmitError(error, tExercises)
        )
      )
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {question.choices.map((choice) => (
        <TryoutChoice
          key={choice.optionKey}
          value={{
            choice,
            disabled: locked,
            onSelect: () => saveChoice(choice),
            question,
          }}
        />
      ))}
    </div>
  );
}
/** Renders one selectable answer option in the production exercise style. */
function TryoutChoice({ value }: { value: TryoutChoiceValue }) {
  const { choice, disabled, onSelect, question } = value;
  const checked = question.response?.selectedOptionId === choice.optionKey;
  return (
    <TryoutSelectableChoice
      checked={checked}
      disabled={disabled}
      id={`${question.placementId}-${choice.optionKey}`}
      label={choice.label}
      onSelect={onSelect}
    />
  );
}
interface TryoutChoiceValue {
  choice: TryoutRuntimeChoice;
  disabled: boolean;
  onSelect: () => void;
  question: TryoutRuntimeQuestion;
}
/** Applies a Convex optimistic answer snapshot to the matching runtime query. */
function applyOptimisticResponse(
  runtime: TryoutSectionRuntime,
  args: SaveResponseArgs
) {
  const selectedAt = Date.now();
  let foundQuestion = false;
  let answeredFirstTime = false;
  const questions = runtime.questions.map((runtimeQuestion) => {
    if (runtimeQuestion.placementId !== args.placementId) {
      return runtimeQuestion;
    }
    foundQuestion = true;
    answeredFirstTime = !runtimeQuestion.response;
    return {
      ...runtimeQuestion,
      response: {
        answeredAt: runtimeQuestion.response?.answeredAt ?? selectedAt,
        selectedOptionId: args.selectedOptionId,
        updatedAt: selectedAt,
      },
    };
  });
  if (!foundQuestion) {
    return null;
  }
  if (!answeredFirstTime) {
    return {
      ...runtime,
      questions,
    };
  }
  return {
    ...runtime,
    questions,
    section: {
      ...runtime.section,
      answeredCount: Math.min(
        runtime.section.totalQuestions,
        runtime.section.answeredCount + 1
      ),
    },
  };
}
/** Handles Convex answer-save failures with the existing exercise toasts. */
function handleSubmitError(
  error: unknown,
  tExercises: ReturnType<typeof useTranslations>
) {
  if (!(error instanceof ConvexError)) {
    return reportSubmitException(error).pipe(
      Effect.andThen(showSubmitError(tExercises))
    );
  }
  const errorData = error.data;
  if (!(typeof errorData === "object" && errorData !== null)) {
    return reportSubmitException(error).pipe(
      Effect.andThen(showSubmitError(tExercises))
    );
  }
  const errorCode = "code" in errorData ? errorData.code : undefined;
  if (
    errorCode === "TRYOUT_EXPIRED" ||
    errorCode === "TRYOUT_ATTEMPT_NOT_ACTIVE" ||
    errorCode === "TRYOUT_SECTION_NOT_ACTIVE"
  ) {
    return Effect.sync(() => {
      toast.info(tExercises("attempt-not-in-progress"), {
        position: "bottom-center",
      });
    });
  }
  return reportClientException(error, {
    ...(typeof errorCode === "string" ? { convex_error_code: errorCode } : {}),
    source: "tryout-submit-answer",
  }).pipe(Effect.andThen(showSubmitError(tExercises)));
}
/** Reports an unexpected submit failure to analytics. */
function reportSubmitException(error: unknown) {
  return reportClientException(error, {
    source: "tryout-submit-answer",
  });
}
/** Shows the existing exercise answer-save error toast. */
function showSubmitError(tExercises: ReturnType<typeof useTranslations>) {
  return Effect.sync(() => {
    toast.error(tExercises("submit-answer-error"), {
      position: "bottom-center",
    });
  });
}
