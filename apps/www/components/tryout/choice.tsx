"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Response } from "@repo/design-system/components/ai/response";
import type { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import type {
  TryoutRuntimeChoice,
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/types";
import { reportClientException } from "@/lib/analytics/client";

type SaveResponseArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.saveResponse
>;

interface TryoutChoicesProps {
  isLocked: boolean;
  isReviewMode: boolean;
  question: TryoutRuntimeQuestion;
  sectionStartedAt: number;
}

/** Renders and saves selectable answers for one runtime question. */
export function TryoutChoices({
  isLocked,
  isReviewMode,
  question,
  sectionStartedAt,
}: TryoutChoicesProps) {
  const saveResponse = useMutation(
    api.tryouts.mutations.attempts.saveResponse
  ).withOptimisticUpdate((localStore, args) => {
    const runtimeQueries = localStore.getAllQueries(
      api.tryouts.queries.attempt.getSectionRuntime
    );

    for (const runtimeQuery of runtimeQueries) {
      if (!runtimeQuery.value) {
        continue;
      }

      const nextRuntime = applyOptimisticResponse(runtimeQuery.value, args);

      if (nextRuntime) {
        localStore.setQuery(
          api.tryouts.queries.attempt.getSectionRuntime,
          runtimeQuery.args,
          nextRuntime
        );
      }
    }
  });
  const tExercises = useTranslations("Exercises");

  /** Saves one selected choice through Convex with elapsed section time. */
  function saveChoice(choice: TryoutRuntimeChoice) {
    if (isLocked) {
      return;
    }

    const saveRequest = saveResponse({
      placementId: question.placementId,
      selectedOptionId: choice.optionKey,
      timeSpent: getElapsedSeconds(sectionStartedAt),
    });

    Effect.runPromise(
      Effect.tryPromise({
        try: () => saveRequest,
        catch: (cause) => cause,
      }).pipe(Effect.catchAll((error) => handleSubmitError(error, tExercises)))
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {question.choices.map((choice) => (
        <TryoutChoice
          choice={choice}
          disabled={isLocked}
          isReviewMode={isReviewMode}
          key={choice.optionKey}
          onSelect={() => saveChoice(choice)}
          question={question}
        />
      ))}
    </div>
  );
}

/** Renders one selectable answer option in the production exercise style. */
function TryoutChoice({
  choice,
  disabled,
  isReviewMode,
  onSelect,
  question,
}: {
  choice: TryoutRuntimeChoice;
  disabled: boolean;
  isReviewMode: boolean;
  onSelect: () => void;
  question: TryoutRuntimeQuestion;
}) {
  const checked = question.response?.selectedOptionId === choice.optionKey;
  const variant = getChoiceVariant({ checked, choice, isReviewMode });

  return (
    <Label
      className={cn(
        buttonVariants({ variant }),
        "h-auto min-w-0 whitespace-normal text-left font-normal text-base"
      )}
    >
      <Checkbox
        checked={checked}
        className="mt-1 shrink-0 cursor-pointer"
        disabled={disabled}
        onCheckedChange={(nextChecked) => {
          if (nextChecked) {
            onSelect();
          }
        }}
      />
      <Response
        className="wrap-anywhere h-auto min-w-0 flex-1 whitespace-normal"
        id={`${question.questionId}-${choice.optionKey}`}
      >
        {choice.label}
      </Response>
    </Label>
  );
}

/** Applies a Convex optimistic answer snapshot to the matching runtime query. */
function applyOptimisticResponse(
  runtime: TryoutSectionRuntime,
  args: SaveResponseArgs
) {
  if (!args.selectedOptionId) {
    return null;
  }

  const selectedAt = runtime.section.startedAt + args.timeSpent * 1000;
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

/** Calculates elapsed whole seconds since a Convex section start timestamp. */
function getElapsedSeconds(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/** Selects the production answer option variant for active and review modes. */
function getChoiceVariant({
  checked,
  choice,
  isReviewMode,
}: {
  checked: boolean;
  choice: TryoutRuntimeChoice;
  isReviewMode: boolean;
}): ComponentProps<typeof Button>["variant"] {
  if (!isReviewMode) {
    return checked ? "default-outline" : "outline";
  }

  if (checked && !choice.isCorrect) {
    return "destructive-outline";
  }

  if (choice.isCorrect) {
    return "default-outline";
  }

  return "outline";
}

/** Handles Convex answer-save failures with the existing exercise toasts. */
function handleSubmitError(
  error: unknown,
  tExercises: ReturnType<typeof useTranslations>
) {
  if (!(error instanceof ConvexError)) {
    return reportSubmitException(error).pipe(
      Effect.zipRight(showSubmitError(tExercises))
    );
  }

  const errorData = error.data;

  if (!(typeof errorData === "object" && errorData !== null)) {
    return reportSubmitException(error).pipe(
      Effect.zipRight(showSubmitError(tExercises))
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
  }).pipe(Effect.zipRight(showSubmitError(tExercises)));
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
