import {
  Array as Arr,
  Option,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";

/** A placeholder of a formula in a demo sentence: `<mass></mass>` names the formula `mass`. */
const FORMULA_TAG = /<(?<name>\w+)><\/\k<name>>/u;

/** The JSON text of a document, as the server stores it. */
const DocumentText = Schema.fromJsonString(Schema.Unknown);

/** The school the demo exams belong to. Its address only keys the demo's reads. */
export const DEMO_SLUG = "demo";

/** The id of a demo exam. Each demo holds one exam on a server of its own, so one id serves every demo. */
export const DEMO_EXAM_ID = "seedexam";

/** The formulas the demo's sentences and options name, in LaTeX. */
const FORMULAS: Readonly<Record<string, string>> = {
  cart: "4\\ \\text{kg}",
  formula: "p = m v = 2 \\cdot 3 = 6\\ \\text{kg}\\cdot\\text{m/s}",
  kilogram: "\\text{kg}",
  mass: "2\\ \\text{kg}",
  pace: "2.5\\ \\text{m/s}",
  rate: "\\text{m/s}",
  speed: "3\\ \\text{m/s}",
  total: "p = 4 \\cdot 2.5 = 10\\ \\text{kg}\\cdot\\text{m/s}",
  unit: "\\text{kg}\\cdot\\text{m/s}",
};

/**
 * The inline content of one sentence: its words as text, and each formula it names as an inline formula, the way
 * the editor writes a formula a teacher types.
 */
const inline = (sentence: string) =>
  Arr.getSomes(
    Arr.map(Str.split(sentence, FORMULA_TAG), (part, index) => {
      if (index % 2 === 1) {
        return Option.map(Rec.get(FORMULAS, part), (latex) => ({
          attrs: { latex },
          type: "mathInline",
        }));
      }
      return part === ""
        ? Option.none()
        : Option.some({ text: part, type: "text" });
    })
  );

/** A document of one paragraph holding `content`. */
const paragraphOf = (content: readonly unknown[]) => ({
  content: [
    content.length === 0
      ? { type: "paragraph" }
      : { content, type: "paragraph" },
  ],
  type: "doc",
});

/** A document holding one LaTeX formula alone, as an option whose label is all math is written. */
export const latexLabel = (latex: string) =>
  paragraphOf([{ attrs: { latex }, type: "mathInline" }]);

/** A document of one sentence, as an option's label is written: its words, and its formulas as math. */
export const sentenceLabel = (sentence: string) =>
  paragraphOf(inline(sentence));

/** A document holding one of the demo's formulas alone, by its name. */
export const formulaLabel = (name: string) =>
  sentenceLabel(`<${name}></${name}>`);

/** The JSON text of a document of one sentence, as the server stores a question's text. */
export const sentenceText = (sentence: string) =>
  Schema.encodeSync(DocumentText)(sentenceLabel(sentence));

/** The JSON text of a document holding one formula alone. */
export const formulaText = (name: string) =>
  sentenceText(`<${name}></${name}>`);
