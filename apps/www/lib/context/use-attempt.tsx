"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Locale } from "next-intl";
import { useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useUser } from "@/lib/context/use-user";

type LatestAttemptResult = Ref.Returns<
  typeof refs.public.exercises.queries.getLatestAttemptBySlug
>;
type QuestionAnswerSheet = Ref.Returns<
  typeof refs.public.exercises.queries.getQuestionAnswerSheetBySlug
>;
type AttemptAnswer = NonNullable<LatestAttemptResult>["answers"][number];
interface AttemptSourceValue {
  answerSheet: QuestionAnswerSheet;
  answers: NonNullable<LatestAttemptResult>["answers"];
  attempt: NonNullable<LatestAttemptResult>["attempt"] | null;
  isInputLocked: boolean;
  isReviewMode: boolean;
  slug: string;
}

type AttemptContextValue = AttemptSourceValue & {
  answerByExercise: Map<number, AttemptAnswer>;
  answerSheetByExercise: Map<number, QuestionAnswerSheet[number]>;
  attemptId: NonNullable<LatestAttemptResult>["attempt"]["_id"] | null;
  attemptMode: NonNullable<LatestAttemptResult>["attempt"]["mode"] | null;
  attemptStatus: NonNullable<LatestAttemptResult>["attempt"]["status"] | null;
  isAttemptInProgress: boolean;
  isSimulationInProgress: boolean;
};

const AttemptContext = createContext<AttemptContextValue | null>(null);

/** Builds a keyed lookup for exercise-based rows inside the attempt context. */
function createExerciseMap<T extends { exerciseNumber: number }>(
  entries: readonly T[]
) {
  return new Map(entries.map((entry) => [entry.exerciseNumber, entry]));
}

/** Provides one normalized attempt snapshot to the exercise runtime subtree. */
export function AttemptProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AttemptSourceValue;
}) {
  const { answerSheet, answers, attempt, isInputLocked, isReviewMode, slug } =
    value;
  const contextValue = useMemo(() => {
    const attemptStatus = attempt?.status ?? null;
    const attemptMode = attempt?.mode ?? null;

    return {
      answerSheet,
      answers,
      attempt,
      answerByExercise: createExerciseMap(answers),
      answerSheetByExercise: createExerciseMap(answerSheet),
      attemptId: attempt?._id ?? null,
      attemptMode,
      attemptStatus,
      isInputLocked,
      isAttemptInProgress: attemptStatus === "in-progress",
      isReviewMode,
      isSimulationInProgress:
        attemptStatus === "in-progress" && attemptMode === "simulation",
      slug,
    };
  }, [answerSheet, answers, attempt, isInputLocked, isReviewMode, slug]);

  return (
    <AttemptContext.Provider value={contextValue}>
      {children}
    </AttemptContext.Provider>
  );
}

/** Hydrates the default learn-route attempt state from the authenticated user. */
export function AttemptContextProvider({
  children,
  locale,
  slug,
}: {
  children: React.ReactNode;
  locale: Locale;
  slug: string;
}) {
  const user = useUser((state) => state.user);
  const resultsQuery = useQuery(
    refs.public.exercises.queries.getLatestAttemptBySlug,
    user ? { slug } : "skip"
  );
  const answerSheetQuery = useQuery(
    refs.public.exercises.queries.getQuestionAnswerSheetBySlug,
    user ? { locale, slug } : "skip"
  );
  const results = QueryResult.isSuccess(resultsQuery)
    ? resultsQuery.value
    : undefined;
  const answerSheet = QueryResult.isSuccess(answerSheetQuery)
    ? answerSheetQuery.value
    : undefined;

  return (
    <AttemptProvider
      value={{
        answerSheet: answerSheet ?? [],
        slug,
        attempt: results?.attempt || null,
        answers: results?.answers || [],
        isInputLocked: false,
        isReviewMode: false,
      }}
    >
      {children}
    </AttemptProvider>
  );
}

/** Selects one slice of the current attempt context. */
export function useAttempt<T>(selector: (state: AttemptContextValue) => T) {
  const context = useContextSelector(AttemptContext, (value) => value);
  if (!context) {
    throw new Error("useAttempt must be used within a AttemptContextProvider");
  }
  return selector(context);
}
