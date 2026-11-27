import { Array as Arr, Option, Record as Rec, Schema } from "effect";

const FormulaRunKindSchema = Schema.Literals(["normal", "sub", "sup"]);

const FormulaRunSchema = Schema.Struct({
  kind: FormulaRunKindSchema,
  text: Schema.String,
});
type FormulaRun = typeof FormulaRunSchema.Type;

const SUBSCRIPT_GLYPHS: Readonly<Record<string, string>> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  ₙ: "n",
};

const SUPERSCRIPT_GLYPHS: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
};

function classifyGlyph(glyph: string): FormulaRun {
  const sub = Rec.get(SUBSCRIPT_GLYPHS, glyph);
  if (Option.isSome(sub)) {
    return { kind: "sub", text: sub.value };
  }
  const sup = Rec.get(SUPERSCRIPT_GLYPHS, glyph);
  if (Option.isSome(sup)) {
    return { kind: "sup", text: sup.value };
  }
  return { kind: "normal", text: glyph };
}

/**
 * Splits a Unicode chemical formula or unit (such as `"AgNO₃"`, `"CuSO₄"`,
 * `"Ca²⁺"`, or `"dm³"`) into contiguous typography runs so Canvas 2D can draw
 * true baseline-shifted subscripts and superscripts crisply on every font.
 */
export function parseFormulaRuns(formula: string): readonly FormulaRun[] {
  const initial: readonly FormulaRun[] = [];
  return Arr.reduce(Arr.fromIterable(formula), initial, (runs, glyph) => {
    const next = classifyGlyph(glyph);
    const last = Arr.last(runs);
    if (Option.isSome(last) && last.value.kind === next.kind) {
      return Arr.append(Arr.dropRight(runs, 1), {
        kind: next.kind,
        text: `${last.value.text}${next.text}`,
      });
    }
    return Arr.append(runs, next);
  });
}
