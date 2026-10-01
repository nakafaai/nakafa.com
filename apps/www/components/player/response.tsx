import type { Option } from "effect";
import type { ComponentType, ReactNode } from "react";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";
import type { TryoutRenderableResponseSpec } from "@/components/tryout/runtime/types";

/** A response definition the player renders: runtime or authored preview. */
export type PlayerResponseSpec = TryoutRenderableResponseSpec;

/** A learner selection in the backend response contract. */
export type PlayerSelection = TryoutResponseSelection;

/** One rich Markdown label of an option, statement, or category. */
export interface PlayerResponseLabel {
  readonly correctness?: boolean | undefined;
  readonly id: string;
  readonly label: string;
}

/** Everything one response renderer needs, whatever its kind. */
export interface PlayerResponseValue {
  /** DOM id prefix, unique per placement. */
  readonly id: string;
  /** Read-only when time ran out or the section is finishing. */
  readonly locked: boolean;
  /** Saves at once; `null` clears the response. */
  readonly onChange: (selection: PlayerSelection | null) => void;
  readonly renderLabel: (label: PlayerResponseLabel) => ReactNode;
  readonly responseSpec: PlayerResponseSpec;
  /** Preview only: shows which choices are correct. */
  readonly revealAnswers?: boolean;
  readonly selection: PlayerSelection | null;
}

/** The renderer and optional digit shortcut of one response kind. */
export interface PlayerResponseEntry {
  readonly Fields: ComponentType<{ readonly value: PlayerResponseValue }>;
  /**
   * Maps digit keys 1 to 5 (index 0 to 4) to the next selection; `none` when
   * the digit does not apply, `some(null)` to clear the response.
   */
  readonly pick?: (
    value: Pick<PlayerResponseValue, "responseSpec" | "selection">,
    index: number
  ) => Option.Option<PlayerSelection | null>;
}

/** One entry per response kind of the contract; a new kind fails the build. */
export type PlayerResponses = {
  readonly [Kind in PlayerResponseSpec["kind"]]: PlayerResponseEntry;
};

/** Renders a response through the registry entry of its kind. */
export function ResponseFields({
  registry,
  value,
}: {
  readonly registry: PlayerResponses;
  readonly value: PlayerResponseValue;
}) {
  const { Fields } = registry[value.responseSpec.kind];
  return <Fields value={value} />;
}
