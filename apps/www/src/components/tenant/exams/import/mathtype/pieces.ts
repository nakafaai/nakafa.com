import { Array as Arr, Option, Record as Rec } from "effect";
import {
  functionName,
  isRelation,
} from "@/components/tenant/exams/import/mathtype/symbols";

/** A piece of a line in math mode: a character, or a whole template, pile or matrix. */
export const mathPiece = (latex: string) => ({
  kind: "math" as const,
  latex,
  opens: false,
});

/** A character of text, which joins its neighbours in one `\text`. */
export const textPiece = (latex: string) => ({
  kind: "text" as const,
  latex,
  opens: false,
});

/** A letter of a function name, which joins the letters after it until the next name opens. */
export const namePiece = (latex: string, opens: boolean) => ({
  kind: "name" as const,
  latex,
  opens,
});

/** A script, which follows the piece before it as its base. */
export const scriptPiece = (latex: string) => ({
  kind: "script" as const,
  latex,
  opens: false,
});

/** Any piece of a line. */
export type Piece =
  | ReturnType<typeof mathPiece>
  | ReturnType<typeof textPiece>
  | ReturnType<typeof namePiece>
  | ReturnType<typeof scriptPiece>;

/** Whether a piece continues the run before it: text after text, and a letter within a name. */
const continues = (run: Piece, piece: Piece) =>
  run.kind === piece.kind &&
  (piece.kind === "text" || (piece.kind === "name" && !piece.opens));

/** The runs of a line: neighbouring text pieces join, and so do the letters of one name. */
const runsOf = (pieces: readonly Piece[]) =>
  Arr.reduce(pieces, Arr.empty<Piece>(), (runs, piece) =>
    Option.match(Arr.last(runs), {
      onNone: () => Arr.append(runs, piece),
      onSome: (run) =>
        continues(run, piece)
          ? Arr.append(Arr.dropRight(runs, 1), {
              ...run,
              latex: `${run.latex}${piece.latex}`,
            })
          : Arr.append(runs, piece),
    })
  );

/** A command name at the end of LaTeX, which a letter after it would lengthen. */
const TRAILING_COMMAND = /\\[A-Za-z]+$/;

/** A letter at the start of LaTeX. */
const LEADING_LETTER = /^[A-Za-z]/;

/**
 * Two pieces of LaTeX side by side, with a space between them only where a command name ends and
 * a letter follows, so `\\alpha` then `x` stays two tokens.
 */
const joinLatex = (left: string, right: string) =>
  TRAILING_COMMAND.test(left) && LEADING_LETTER.test(right)
    ? `${left} ${right}`
    : `${left}${right}`;

/** The LaTeX of one run. */
const runLatex = (run: Piece) => {
  if (run.kind === "text") {
    return `\\text{${run.latex}}`;
  }
  return run.kind === "name" ? functionName(run.latex) : run.latex;
};

/**
 * The LaTeX of one line. A line that starts with a script gives it an empty base. On a pile
 * aligned at its relations, the line's first relation takes the alignment mark.
 */
const lineOf = (pieces: readonly Piece[], aligned: boolean) => {
  const runs = runsOf(pieces);
  const relation = aligned
    ? Arr.findFirstIndex(
        runs,
        (run) => run.kind === "math" && isRelation(run.latex)
      )
    : Option.none();
  return Arr.reduce(
    Arr.map(runs, (run, index) => {
      const base = index === 0 && run.kind === "script" ? "{}" : "";
      const mark = Option.contains(relation, index) ? "&" : "";
      return `${mark}${base}${runLatex(run)}`;
    }),
    "",
    joinLatex
  );
};

/** The LaTeX of one line of an equation. */
export const lineLatex = (pieces: readonly Piece[]) => lineOf(pieces, false);

/** The column a pile's horizontal alignment sets: left, centre, or right, as decimal points align too. */
const PILE_COLUMNS: Rec.ReadonlyRecord<string, string> = {
  1: "l",
  2: "c",
  3: "r",
  5: "r",
};

/** The pile alignment that lines up each line at its first relation. */
const RELATION_ALIGNMENT = 4;

/**
 * The LaTeX of a pile of lines: one line as itself, lines aligned at their relations as an
 * aligned block, and other lines as a one-column array in the pile's alignment.
 */
export const pileLatex = (
  alignment: number,
  lines: readonly (readonly Piece[])[]
) => {
  if (lines.length === 1) {
    return Arr.join(Arr.map(lines, lineLatex), "");
  }
  const aligned = alignment === RELATION_ALIGNMENT;
  const body = Arr.join(
    Arr.map(lines, (line) => lineOf(line, aligned)),
    " \\\\ "
  );
  if (aligned) {
    return `\\begin{aligned} ${body} \\end{aligned}`;
  }
  const column = Option.getOrElse(
    Rec.get(PILE_COLUMNS, String(alignment)),
    () => "l"
  );
  return `\\begin{array}{${column}} ${body} \\end{array}`;
};

/** The LaTeX of a matrix from its cells, row by row. */
export const matrixLatex = (columns: number, cells: readonly string[]) =>
  `\\begin{matrix} ${Arr.join(
    Arr.map(Arr.chunksOf(cells, columns), (row) => Arr.join(row, " & ")),
    " \\\\ "
  )} \\end{matrix}`;
