import { createContext, use } from "react";
import type { PracticeState } from "@/components/tryout/practice/model";

/** The open practice session of the page, which `TryoutPractice` provides once its questions are frozen. */
export const PracticeStateContext = createContext<PracticeState | null>(null);

/** The open practice session, read by the session's player under `TryoutPractice`. */
export function usePracticeState() {
  const state = use(PracticeStateContext);
  if (state === null) {
    throw new Error("usePracticeState must be used within TryoutPractice");
  }
  return state;
}
