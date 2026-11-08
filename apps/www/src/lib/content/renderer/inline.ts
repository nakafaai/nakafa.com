import { Array as Arr, Option, Schema } from "effect";

/** One piece of a visual's string prop: plain text, or a formula between dollar signs. */
const InlinePieceSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("math"), math: Schema.String }),
]);
export type InlinePiece = typeof InlinePieceSchema.Type;

/**
 * A formula between dollar signs, as Markdown writes inline math: the opening
 * `$` is not escaped and touches its formula, the closing `$` touches it too
 * and is not followed by a digit, so a price such as `$5 and $10` stays text.
 */
const INLINE_MATH = /(?<!\\)\$(?=\S)(?:\\.|[^$\\])*?\S\$(?!\d)/gu;

/** One run of text between formulas, with each escaped `\$` back to a dollar sign. */
function textPieces(text: string): InlinePiece[] {
  return text === "" ? [] : [{ kind: "text", text: text.replaceAll("\\$", "$") }];
}

/**
 * Splits a string prop into text and formulas, such as
 * `"$\ce{2H2 + O2 -> 2H2O}$ burns"`. A string without a formula gives none, so
 * the prop stays the plain string its author wrote.
 */
export function inlinePieces(
  text: string
): Option.Option<readonly InlinePiece[]> {
  const found = Arr.map(Arr.fromIterable(text.matchAll(INLINE_MATH)), (match) => ({
    end: match.index + match[0].length,
    math: match[0].slice(1, -1),
    start: match.index,
  }));
  if (!Arr.isReadonlyArrayNonEmpty(found)) {
    return Option.none();
  }
  const starts = [0, ...Arr.map(found, ({ end }) => end)];
  return Option.some([
    ...Arr.flatMap(Arr.zip(starts, found), ([from, { math, start }]) => [
      ...textPieces(text.slice(from, start)),
      { kind: "math" as const, math },
    ]),
    ...textPieces(text.slice(Arr.lastNonEmpty(found).end)),
  ]);
}
