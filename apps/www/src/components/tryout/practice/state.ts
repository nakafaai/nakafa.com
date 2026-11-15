import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import type { PracticeState } from "@/components/tryout/practice/model";

/** The open practice session of the page, which `TryoutPractice` provides once its questions are frozen. */
export const PracticeStateContext = createContext<PracticeState | null>(null);

/** The open practice session, read by the session's player under `TryoutPractice`. */
export function usePracticeState() {
  return useRequired(PracticeStateContext, "usePracticeState");
}
