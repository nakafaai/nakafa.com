"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { createContext, useContextSelector } from "use-context-selector";
import { useUser } from "@/lib/context/use-user";

type LatestAttemptResult = FunctionReturnType<
  typeof api.exercises.queries.getLatestAttemptBySlug
>;
type QuestionAnswerSheet = FunctionReturnType<
  typeof api.exercises.queries.getQuestionAnswerSheetBySlug
>;

interface AttemptContextValue {
  answerSheet: QuestionAnswerSheet;
  answers: NonNullable<LatestAttemptResult>["answers"];
  attempt: NonNullable<LatestAttemptResult>["attempt"] | null;
  slug: string;
}

const AttemptContext = createContext<AttemptContextValue | null>(null);

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
  const { data: results } = useQueryWithStatus(
    api.exercises.queries.getLatestAttemptBySlug,
    user ? { slug } : "skip"
  );
  const { data: answerSheet } = useQueryWithStatus(
    api.exercises.queries.getQuestionAnswerSheetBySlug,
    user ? { locale, slug } : "skip"
  );

  return (
    <AttemptContext.Provider
      value={{
        answerSheet: answerSheet ?? [],
        slug,
        attempt: results?.attempt || null,
        answers: results?.answers || [],
      }}
    >
      {children}
    </AttemptContext.Provider>
  );
}

export function useAttempt<T>(selector: (state: AttemptContextValue) => T) {
  const context = useContextSelector(AttemptContext, (value) => value);
  if (!context) {
    throw new Error("useAttempt must be used within a AttemptContextProvider");
  }
  return selector(context);
}
