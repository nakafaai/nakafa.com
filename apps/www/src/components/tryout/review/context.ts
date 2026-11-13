import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { HashSet, type Option } from "effect";
import { createContext } from "react";
import { createStore } from "zustand";
import type { TryoutBody } from "@/components/tryout/content/body";
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
    readonly body: TryoutBody;
    readonly question: TryoutRuntimeQuestion;
  }[];
  readonly limit: Option.Option<number>;
  readonly runtime: TryoutSectionRuntime;
  readonly score: TryoutScoreResult;
} | null>(null);

/**
 * Creates the explanations a review shows open, by question, with the one action that opens or closes
 * one: its question's own button and the result's footer both press it.
 */
export function createExplainedStore() {
  return createStore<{
    readonly open: HashSet.HashSet<string>;
    readonly toggle: (key: string) => void;
  }>()((set) => ({
    open: HashSet.empty(),
    toggle: (key) =>
      set((state) => ({
        open: HashSet.has(state.open, key)
          ? HashSet.remove(state.open, key)
          : HashSet.add(state.open, key),
      })),
  }));
}

/** The explanations of one review, which its provider creates once. */
export const TryoutExplainedContext = createContext<ReturnType<
  typeof createExplainedStore
> | null>(null);
