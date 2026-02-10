"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { createContext, useContextSelector } from "use-context-selector";
import { useUser } from "@/lib/context/use-user";

interface AttemptContextValue {
  slug: string;
  attempt: Doc<"exerciseAttempts"> | null;
  answers: Doc<"exerciseAnswers">[];
}

const AttemptContext = createContext<AttemptContextValue | null>(null);

export function AttemptContextProvider({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const user = useUser((state) => state.user);
  const { data: results } = useQueryWithStatus(
    api.exercises.queries.getLatestAttemptBySlug,
    user ? { slug } : "skip"
  );

  return (
    <AttemptContext.Provider
      value={{
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
