import { partLetter } from "@repo/backend/confect/exams/letters";
import { Array as Arr, Option, Schema } from "effect";
import type { MatchPart } from "@/components/exams/sitting/response";

/** A place on a board, in the board's own pixels, so a paper drawn at any zoom keeps its lines on its dots. */
export const LinePoint = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type LinePoint = typeof LinePoint.Type;

/** How far a pull travels before it draws, so a press that wobbles stays a press. */
const PULL_START = 4;

/**
 * The curve of a line: it leaves each dot level and bends once halfway, as a pencil line drawn between two
 * columns does, so lines that cross stay apart and each one reads back to its own dot.
 */
export const linePath = (from: LinePoint, to: LinePoint) => {
  const middle = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${middle} ${from.y} ${middle} ${to.y} ${to.x} ${to.y}`;
};

/**
 * Where the remove control of a line stands: in the middle of the gap between the columns, as far from either dot,
 * on its statement's row, so the controls of two statements never stand on each other and none stands on a dot or a
 * row's outline. The line is cut around it (`removeRadius`), so it never runs under the control.
 */
export const removePoint = (from: LinePoint, to: LinePoint): LinePoint => ({
  x: (from.x + to.x) / 2,
  y: from.y,
});

/** How far a line stays from the middle of a remove control: the control's half (16) and a gap (4). */
export const REMOVE_CLEARANCE = 20;

/**
 * A point of the screen in a board's own pixels. A board drawn smaller or larger than its layout, as the editor's
 * zoom draws a paper, divides by its scale, and a board of no width yet, such as one in a closed sheet, takes one.
 */
export const boardPoint = (
  point: { readonly x: number; readonly y: number },
  box: { readonly left: number; readonly top: number; readonly width: number },
  layoutWidth: number
): LinePoint => {
  const scale =
    layoutWidth === 0 || box.width === 0 ? 1 : box.width / layoutWidth;
  return { x: (point.x - box.left) / scale, y: (point.y - box.top) / scale };
};

/** Whether a pointer has moved far enough from where it pressed to be a pull. */
export const isPull = (from: LinePoint, to: LinePoint) =>
  Math.hypot(to.x - from.x, to.y - from.y) >= PULL_START;

/**
 * The names a board gives its parts: each statement its number from one, and each answer its letter in the script
 * of the answers' labels, as the paper names them.
 */
export const lineNames = (match: Pick<MatchPart, "sources" | "targets">) => ({
  sources: Arr.map(match.sources, (part, index) => ({
    id: part.id,
    name: String(index + 1),
  })),
  targets: Arr.map(match.targets, (part, index) => ({
    id: part.id,
    name: partLetter(match.targets, index),
  })),
});

/** The name of one part of a board, or none for a part the board does not hold. */
export const nameOf = (
  names: ReturnType<typeof lineNames>,
  id: string
): Option.Option<string> =>
  Option.map(
    Arr.findFirst(
      [...names.sources, ...names.targets],
      (part) => part.id === id
    ),
    (part) => part.name
  );
