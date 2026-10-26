import { checkFormula } from "@repo/design-system/components/editor/render";
import { Array as Arr, Effect, Match, Option } from "effect";
import {
  type Cursor,
  cursorOf,
  pairOf,
  signedOf,
  skip,
  skipNudge,
  skipRuler,
  skipString,
  skipStyle,
} from "@/components/tenant/exams/import/mathtype/cursor";
import { MathTypeUnread } from "@/components/tenant/exams/import/mathtype/errors";
import {
  hasFlag,
  wordOf,
} from "@/components/tenant/exams/import/mathtype/flags";
import { oleStream } from "@/components/tenant/exams/import/mathtype/ole";
import {
  lineLatex,
  mathPiece,
  matrixLatex,
  namePiece,
  type Piece,
  pileLatex,
  scriptPiece,
  textPiece,
} from "@/components/tenant/exams/import/mathtype/pieces";
import {
  embellish,
  mathSymbol,
  textSymbol,
} from "@/components/tenant/exams/import/mathtype/symbols";
import { templateLatex } from "@/components/tenant/exams/import/mathtype/templates";

/** The stream of a MathType object that holds its equation. */
const EQUATION_STREAM = "Equation Native";

/** The MTEF version MathType 4 and later write. */
const MTEF_VERSION = 5;

/** The record types of MTEF 5 that build an equation, by their number. */
const END = 0;
const LINE = 1;
const CHAR = 2;
const TMPL = 3;
const PILE = 4;
const MATRIX = 5;
const EMBELL = 6;

/** The option bits of the records: a null line, line spacing, a ruler, and a character's own data. */
const LINE_NULL = 0x01;
const LINE_SPACING = 0x04;
const LINE_RULER = 0x02;
const CHAR_EMBELL = 0x01;
const CHAR_FUNCTION_START = 0x02;
const CHAR_FONT_8 = 0x04;
const CHAR_FONT_16 = 0x10;
const CHAR_NO_CODE = 0x20;

/** The typefaces of MTEF 5 that set how a character is written: text, a function name, and a marker. */
const TEXT_FACES = [1, 12];
const FUNCTION_FACE = 2;
const MARKER_FACE = 23;

/** The deepest nesting of templates and piles the reader follows; deeper input is no equation. */
const MAX_DEPTH = 64;

/** The last ASCII code: a character past it with a math command, such as Greek, is written as math. */
const ASCII_END = 0x7f;

/** LaTeX that starts with a command name. */
const COMMAND = /^\\[A-Za-z]/;

/** Whether a character's math LaTeX is a command, as a Greek letter typed in text style is. */
const isCommand = (latex: Option.Option<string>) =>
  Option.exists(latex, (command) => COMMAND.test(command));

/** A letter of the Latin alphabet, the only character a function name joins. */
const LETTER = /^[A-Za-z]$/;

/**
 * What a record adds to its list: a line with its pieces, which a template, pile or matrix reads
 * as a slot, row or cell; one piece, or none for a character or template this reader cannot
 * write; and a mark of the character before it.
 */
const lineEntry = (pieces: readonly Piece[]) => ({
  _tag: "Line" as const,
  pieces,
});
const pieceEntry = (piece: Option.Option<Piece>) => ({
  _tag: "Piece" as const,
  piece,
});
const markEntry = (mark: number) => ({ _tag: "Mark" as const, mark });

type Entry =
  | ReturnType<typeof lineEntry>
  | ReturnType<typeof pieceEntry>
  | ReturnType<typeof markEntry>;

/** The lines among a list's entries, in order. */
const linesOf = (entries: readonly Entry[]) =>
  Arr.flatMap(entries, (entry) =>
    entry._tag === "Line" ? [entry.pieces] : []
  );

/**
 * The piece of one character: text joins a `\text` run, a letter of a function name joins its
 * name, and any other character is math with its marks. A marker draws nothing. None for a
 * character this reader cannot write.
 */
const characterPiece = (
  face: number,
  code: Option.Option<number>,
  marks: readonly number[],
  opens: boolean
) =>
  Option.flatMap(code, (character): Option.Option<Piece> => {
    if (face === MARKER_FACE) {
      return Option.some(mathPiece(""));
    }
    if (
      Arr.contains(TEXT_FACES, face) &&
      marks.length === 0 &&
      !(character > ASCII_END && isCommand(mathSymbol(character)))
    ) {
      return Option.map(textSymbol(character), textPiece);
    }
    const plain = String.fromCharCode(character);
    if (face === FUNCTION_FACE && marks.length === 0 && LETTER.test(plain)) {
      return Option.some(namePiece(plain, opens));
    }
    return Option.map(
      Option.flatMap(mathSymbol(character), (latex) => embellish(latex, marks)),
      mathPiece
    );
  });

/** The pieces of a line's entries: its characters and templates, and the pieces of a nested line. */
const linePieces = (entries: readonly Entry[]) =>
  Effect.forEach(entries, (entry) =>
    Match.value(entry).pipe(
      Match.tag("Line", (line) => Effect.succeed(line.pieces)),
      Match.tag("Piece", ({ piece }) =>
        Effect.fromOption(Option.map(piece, Arr.of)).pipe(
          Effect.mapError(() => new MathTypeUnread({ reason: "unsupported" }))
        )
      ),
      Match.tag("Mark", () => Effect.succeed([])),
      Match.exhaustive
    )
  ).pipe(Effect.map(Arr.flatten));

/** A record list: records until its END, at most `MAX_DEPTH` lists deep. */
const readList = (
  cursor: Cursor,
  depth: number
): Effect.Effect<readonly Entry[], MathTypeUnread> =>
  Effect.gen(function* () {
    if (depth > MAX_DEPTH) {
      return yield* new MathTypeUnread({ reason: "record" });
    }
    let entries: readonly Entry[] = [];
    let type = yield* cursor.byte;
    while (type !== END) {
      entries = Arr.appendAll(entries, yield* readRecord(cursor, type, depth));
      type = yield* cursor.byte;
    }
    return entries;
  });

/** A LINE: its pieces, or none for a null line, which holds no list. */
const readLine = (cursor: Cursor, depth: number) =>
  Effect.gen(function* () {
    const options = yield* cursor.byte;
    yield* skipNudge(cursor, options);
    if (hasFlag(options, LINE_SPACING)) {
      yield* pairOf(cursor);
    }
    if (hasFlag(options, LINE_RULER)) {
      yield* cursor.byte;
      yield* skipRuler(cursor);
    }
    if (hasFlag(options, LINE_NULL)) {
      return [lineEntry([])];
    }
    return [lineEntry(yield* linePieces(yield* readList(cursor, depth + 1)))];
  });

/** A CHAR: its typeface, its MTCode, its font position, and the marks it carries. */
const readChar = (cursor: Cursor, depth: number) =>
  Effect.gen(function* () {
    const options = yield* cursor.byte;
    yield* skipNudge(cursor, options);
    const face = yield* signedOf(cursor);
    const code = hasFlag(options, CHAR_NO_CODE)
      ? Option.none()
      : Option.some(yield* pairOf(cursor));
    if (hasFlag(options, CHAR_FONT_8)) {
      yield* cursor.byte;
    }
    if (hasFlag(options, CHAR_FONT_16)) {
      yield* pairOf(cursor);
    }
    const marks = hasFlag(options, CHAR_EMBELL)
      ? Arr.flatMap(yield* readList(cursor, depth + 1), (entry) =>
          entry._tag === "Mark" ? [entry.mark] : []
        )
      : [];
    return [
      pieceEntry(
        characterPiece(face, code, marks, hasFlag(options, CHAR_FUNCTION_START))
      ),
    ];
  });

/** A TMPL: its selector and variation, then its slots, whose structure characters it leaves. */
const readTemplate = (cursor: Cursor, depth: number) =>
  Effect.gen(function* () {
    const options = yield* cursor.byte;
    yield* skipNudge(cursor, options);
    const selector = yield* cursor.byte;
    const first = yield* cursor.byte;
    const variation =
      first < 0x80 ? first : wordOf(first - 0x80, yield* cursor.byte);
    yield* cursor.byte;
    const slots = Arr.map(
      linesOf(yield* readList(cursor, depth + 1)),
      lineLatex
    );
    const template = Option.map(
      templateLatex(selector, variation, slots),
      ({ latex, script }) => (script ? scriptPiece(latex) : mathPiece(latex))
    );
    return [pieceEntry(template)];
  });

/** A PILE: its alignment, then its lines. It stands as a line, so a template takes it as a slot. */
const readPile = (cursor: Cursor, depth: number) =>
  Effect.gen(function* () {
    const options = yield* cursor.byte;
    yield* skipNudge(cursor, options);
    const alignment = yield* cursor.byte;
    yield* cursor.byte;
    if (hasFlag(options, LINE_RULER)) {
      yield* cursor.byte;
      yield* skipRuler(cursor);
    }
    const lines = linesOf(yield* readList(cursor, depth + 1));
    return [lineEntry([mathPiece(pileLatex(alignment, lines))])];
  });

/**
 * A MATRIX: its size, its partition lines, then one line per cell. It stands as a line, so a
 * template takes it as a slot. A matrix that draws partition lines, or whose cells do not fill
 * it, keeps its equation as a picture.
 */
const readMatrix = (cursor: Cursor, depth: number) =>
  Effect.gen(function* () {
    const options = yield* cursor.byte;
    yield* skipNudge(cursor, options);
    yield* skip(cursor, 3);
    const rows = yield* cursor.byte;
    const columns = yield* cursor.byte;
    let partitioned = false;
    const partitionBytes =
      Math.ceil(((rows + 1) * 2) / 8) + Math.ceil(((columns + 1) * 2) / 8);
    for (let index = 0; index < partitionBytes; index += 1) {
      partitioned = partitioned || (yield* cursor.byte) !== 0;
    }
    const cells = Arr.map(
      linesOf(yield* readList(cursor, depth + 1)),
      lineLatex
    );
    const filled =
      !partitioned && cells.length === rows * columns && columns > 0;
    if (!filled) {
      return yield* new MathTypeUnread({ reason: "unsupported" });
    }
    return [lineEntry([mathPiece(matrixLatex(columns, cells))])];
  });

/** One record after its type byte, as the entries it adds to its list. */
function readRecord(
  cursor: Cursor,
  type: number,
  depth: number
): Effect.Effect<readonly Entry[], MathTypeUnread> {
  return Match.value(type).pipe(
    Match.when(LINE, () => readLine(cursor, depth)),
    Match.when(CHAR, () => readChar(cursor, depth)),
    Match.when(TMPL, () => readTemplate(cursor, depth)),
    Match.when(PILE, () => readPile(cursor, depth)),
    Match.when(MATRIX, () => readMatrix(cursor, depth)),
    Match.when(EMBELL, () =>
      Effect.gen(function* () {
        const options = yield* cursor.byte;
        yield* skipNudge(cursor, options);
        return [markEntry(yield* cursor.byte)];
      })
    ),
    Match.orElse((record) => Effect.as(skipStyle(cursor, record), []))
  );
}

/**
 * Reads an equation of MTEF 5 as LaTeX: past the 28-byte header MathType sets before it and the
 * MTEF header with its version, then its records. An equation that is not MTEF 5 (Equation
 * Editor 3 writes MTEF 3) keeps its picture.
 */
export const readEquation = Effect.fn("exams.import.mathtype.read")(function* (
  stream: Uint8Array
) {
  const header = wordOf(stream[0] ?? 0, stream[1] ?? 0);
  const cursor = cursorOf(stream.subarray(header));
  if ((yield* cursor.byte) !== MTEF_VERSION) {
    return yield* new MathTypeUnread({ reason: "version" });
  }
  yield* skip(cursor, 4);
  yield* skipString(cursor);
  yield* cursor.byte;
  return lineLatex(yield* linePieces(yield* readList(cursor, 0)));
});

/**
 * The LaTeX of a MathType equation from the bytes of its OLE object. KaTeX, which draws every
 * formula of the editor, must parse it. A failure names why the equation keeps its picture.
 */
export const mathTypeEquation = Effect.fn("exams.import.mathtype")(function* (
  ole: Uint8Array
) {
  const latex = yield* readEquation(yield* oleStream(ole, EQUATION_STREAM));
  yield* checkFormula(latex).pipe(
    Effect.mapError(() => new MathTypeUnread({ reason: "unsupported" }))
  );
  return latex;
});
