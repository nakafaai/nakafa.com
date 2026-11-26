import type { Ref } from "@confect/core";
import type practice from "@repo/backend/confect/_generated/refs/practice";
import type progress from "@repo/backend/confect/_generated/refs/progress";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { EMPTY_TALLY } from "@repo/backend/confect/progress/schema";
import { useRequired } from "@repo/design-system/hooks/required";
import { Option } from "effect";
import { createContext, use } from "react";
import type { SetPaneMode } from "@/components/tryout/pane/model";
import { NO_CLAIMS } from "@/components/tryout/pane/model";
import type { TryoutSetPaneProps } from "@/components/tryout/pane/set";
import { readSetSections } from "@/components/tryout/set/sections";

type Growth = NonNullable<Ref.Returns<typeof progress.queries.growth>>;
type Claims = NonNullable<Ref.Returns<typeof progress.queries.claims>>;
type Board = Ref.Returns<typeof tryouts.queries.ranks.bySet>;
type PracticeSummary = Ref.Returns<typeof practice.sessions.summary>;

/**
 * What a set's pane draws, built once by the variant that reads it: the set and the learner's attempt, how
 * far the learner grew and what they hold of the set's Stars, the set's leaderboard, its practice summary,
 * and the active pane mode. A visitor's pane reads none of the learner's, so it shows every Star the set
 * gives and medals from nothing.
 */
export function setPaneOf(value: {
  readonly board: Option.Option<Board>;
  readonly claims: Option.Option<Claims>;
  readonly growth: Option.Option<Growth>;
  readonly mode: SetPaneMode;
  readonly practice: Option.Option<PracticeSummary>;
  readonly setMode: (mode: SetPaneMode) => void;
  readonly view: TryoutSetPaneProps["view"];
}) {
  const { page } = value.view;
  return {
    board: value.board,
    claims: Option.getOrElse(value.claims, () => NO_CLAIMS),
    growth: value.growth,
    mode: value.mode,
    practice: Option.getOrElse(value.practice, () => []),
    /** The sections the learner sits: the visible ones, or the one a set is entered through. */
    sections:
      value.view.entrySection === null
        ? page.sections
        : readSetSections({
            entrySection: value.view.entrySection,
            sections: page.sections,
          }),
    setMode: value.setMode,
    tally: Option.match(value.growth, {
      onNone: () => EMPTY_TALLY,
      onSome: (growth) => growth.tally,
    }),
    view: value.view,
  };
}

/** The pane of the open set, which every part of it reads. */
export const SetPaneContext = createContext<ReturnType<
  typeof setPaneOf
> | null>(null);

/** The pane of the open set around the caller. */
export function useSetPane() {
  return useRequired(SetPaneContext, "useSetPane");
}

/** The surrounding set pane, or null when rendered outside the set pane (such as the direct-entry paper). */
export function useOptionalSetPane() {
  return use(SetPaneContext);
}
