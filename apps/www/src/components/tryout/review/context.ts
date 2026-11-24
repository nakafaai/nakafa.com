import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import type { Option } from "effect";
import { HashSet } from "effect";
import { createContext } from "react";
import { createStore } from "zustand";
import type { TryoutBodyVersion } from "@/components/tryout/content/body";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

/**
 * What a finished attempt's review computes as it renders, which its header, its questions, its result and
 * its footer read: each question with its body, the section's runtime and limit, and the score it shows. A finished attempt no longer changes, so the value holds.
 */
export const TryoutReviewContext = createContext<{
  readonly joined: readonly {
    readonly body: TryoutBodyVersion;
    readonly question: TryoutRuntimeQuestion;
  }[];
  readonly limit: Option.Option<number>;
  readonly runtime: TryoutSectionRuntime;
  readonly score: TryoutScoreResult;
} | null>(null);

/** Whether one question's explanation stands open under the review's global and per-question state. */
export function isExplanationOpen(
  state: {
    readonly allOpen: boolean;
    readonly overrides: HashSet.HashSet<string>;
  },
  key: string
) {
  return state.allOpen
    ? !HashSet.has(state.overrides, key)
    : HashSet.has(state.overrides, key);
}

/**
 * Creates the explanations a review shows open: a question's own toggle flips its override, while the
 * pane's toggle opens every explanation at once (or closes them all once already open). Both return
 * whether the action opened an explanation.
 */
export function createExplainedStore() {
  return createStore<{
    readonly allOpen: boolean;
    readonly overrides: HashSet.HashSet<string>;
    readonly toggle: (key: string) => boolean;
    readonly toggleAll: (current: string | null) => boolean;
  }>()((set, get) => ({
    allOpen: false,
    overrides: HashSet.empty(),
    toggle: (key) => {
      const state = get();
      const nextOpen = !isExplanationOpen(state, key);
      set({
        overrides: HashSet.has(state.overrides, key)
          ? HashSet.remove(state.overrides, key)
          : HashSet.add(state.overrides, key),
      });
      return nextOpen;
    },
    toggleAll: (current) => {
      const state = get();
      const nextOpen =
        !state.allOpen ||
        (current !== null && HashSet.has(state.overrides, current));
      set({
        allOpen: nextOpen,
        overrides: HashSet.empty(),
      });
      return nextOpen;
    },
  }));
}

/** The explanations of one review, which its provider creates once. */
export const TryoutExplainedContext = createContext<ReturnType<
  typeof createExplainedStore
> | null>(null);
