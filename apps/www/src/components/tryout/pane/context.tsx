import type { Ref } from "@confect/core";
import type island from "@repo/backend/confect/_generated/refs/island";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import { useRequired } from "@repo/design-system/hooks/required";
import { Option } from "effect";
import { createContext } from "react";
import { NO_CLAIMS } from "@/components/tryout/pane/model";
import type { TryoutSetPaneProps } from "@/components/tryout/pane/set";
import { readSetSections } from "@/components/tryout/set/sections";

type Growth = NonNullable<Ref.Returns<typeof island.queries.growth>>;
type Claims = NonNullable<Ref.Returns<typeof island.queries.claims>>;
type Board = Ref.Returns<typeof tryouts.queries.ranks.bySet>;

/**
 * What a set's pane draws, built once by the variant that reads it: the set and the learner's attempt, how
 * far the learner grew and what they hold of the set's Stars, and the set's leaderboard. A visitor's pane
 * reads none of the learner's, so it shows every Star the set gives and medals from nothing.
 */
export function setPaneOf(value: {
  readonly board: Option.Option<Board>;
  readonly claims: Option.Option<Claims>;
  readonly growth: Option.Option<Growth>;
  readonly view: TryoutSetPaneProps["view"];
}) {
  const { page } = value.view;
  return {
    board: value.board,
    claims: Option.getOrElse(value.claims, () => NO_CLAIMS),
    growth: value.growth,
    /** The sections the learner sits: the visible ones, or the one a set is entered through. */
    sections:
      value.view.entrySection === null
        ? page.sections
        : readSetSections({
            entrySection: value.view.entrySection,
            sections: page.sections,
          }),
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
