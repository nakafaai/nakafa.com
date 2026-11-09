import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import { type StoreApi, useStore } from "zustand";
import type { StartAnswer, StartDraft } from "@/components/tenant/start/state";
import type { TypedName } from "@/components/tenant/start/typed";

/**
 * What every question of the school questionnaire reads: the saved draft, which
 * shows each answer at once, the addresses of the policy pages, the save of one
 * answer, and the store of the name and address the founder types.
 */
type StartValue = Record<"draft", StartDraft> &
  Record<
    "legal",
    Record<"dataProcessing" | "privacy" | "terms", string> | null
  > &
  Record<"save", (answer: StartAnswer) => void> &
  Record<"typed", StoreApi<TypedName>>;

/** The questionnaire of one founder; the form provides it. */
export const StartContext = createContext<StartValue | null>(null);

/** Reads the questionnaire. It throws outside the form, which always provides it. */
export function useStart() {
  return useRequired(StartContext, "useStart");
}

/** Reads one part of the name and address the founder types. It throws outside the form. */
export function useTypedName<Selected>(
  selector: (state: TypedName) => Selected
) {
  return useStore(useStart().typed, selector);
}
