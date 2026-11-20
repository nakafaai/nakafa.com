import {
  type Case,
  CaseSchema,
  casesOf,
  type LogicMode,
  LogicModeSchema,
  rowOf,
  truthOf,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { Array as Arr, Option, Order, Schema } from "effect";

/** How long Play holds each case of the truth table, in seconds. */
export const CASE_SECONDS = 1.8;

/**
 * What the learner has done on the board: the compound wired, the switches
 * as they stand, and the rows of the truth table already tried, in order.
 */
const BoardSchema = Schema.Struct({
  mode: LogicModeSchema,
  state: CaseSchema,
  tried: Schema.Array(Schema.Int),
});
type Board = typeof BoardSchema.Type;

/** A row tried once more keeps its place; a new row joins in table order. */
function withRow(tried: readonly number[], row: number) {
  return Arr.sort(Arr.dedupe([...tried, row]), Order.Number);
}

/** The board as it starts: both switches open, and that one case tried. */
export function startBoard(mode: LogicMode): Board {
  const state = { p: false, q: false };
  return { mode, state, tried: [rowOf(mode, state)] };
}

/** Sets the switches to one case and marks its row tried. */
export function setCase(board: Board, state: Case): Board {
  return {
    ...board,
    state,
    tried: withRow(board.tried, rowOf(board.mode, state)),
  };
}

/** Rewires the board for another compound; its table starts afresh. */
export function setMode(board: Board, mode: LogicMode): Board {
  return { mode, state: board.state, tried: [rowOf(mode, board.state)] };
}

/**
 * The rows of the truth table as the card shows them: each case, whether the
 * switches stand in it now, and the compound's truth once that row was tried.
 */
export function tableRows(board: Board) {
  const current = rowOf(board.mode, board.state);
  return Arr.map(casesOf(board.mode), (each, row) => ({
    case: each,
    current: row === current,
    row,
    truth: Arr.contains(board.tried, row)
      ? Option.some(truthOf(board.mode, each))
      : Option.none(),
  }));
}

/** How long Play takes to run through every case of the compound once. */
export function playSeconds(mode: LogicMode) {
  return casesOf(mode).length * CASE_SECONDS;
}

/** The case Play stands in at `time`, each held `CASE_SECONDS`, the last held to the end. */
export function caseAt(mode: LogicMode, time: number) {
  const cases = casesOf(mode);
  const row = Math.min(
    cases.length - 1,
    Math.max(0, Math.floor(time / CASE_SECONDS))
  );
  return Arr.getUnsafe(cases, row);
}
