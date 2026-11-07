import { Schema } from "effect";
import { createContext, type RefObject, use } from "react";
import type { StoreApi } from "zustand";
import type { lineNames } from "@/components/exams/lines/curve";
import type { LinesStore } from "@/components/exams/lines/store";

/** One pair of a board: a statement and the answer its line reaches. */
const LinePair = Schema.Struct({
  source: Schema.String,
  target: Schema.String,
});
export type LinePair = typeof LinePair.Type;

/**
 * What every part of one board reads: the pairs it draws, the names of its parts, whether it takes changes, the
 * way it pairs and unpairs, its own state, and its element, which its dots are measured in. Functions, a store and an
 * element are no data a Schema describes, so this is a plain shape.
 */
export interface LinesBoard {
  /** Pairs a statement with an answer, taking the answer from any statement that held it. */
  readonly connect: (source: string, target: string) => void;
  /** Takes the line of a statement away. */
  readonly cut: (source: string) => void;
  readonly disabled: boolean;
  readonly names: ReturnType<typeof lineNames>;
  readonly pairs: readonly LinePair[];
  readonly root: RefObject<HTMLDivElement | null>;
  readonly store: StoreApi<LinesStore>;
  /** Whether a press anywhere on a row works its dot, as on a paper no one writes on. */
  readonly stretch: boolean;
}

/** The board a part belongs to. */
export const LinesContext = createContext<LinesBoard | null>(null);

/** Reads the board a part belongs to. It throws outside a board, which always provides it. */
export function useLines() {
  const board = use(LinesContext);
  if (board === null) {
    throw new Error("useLines must be used within LinesProvider");
  }
  return board;
}
