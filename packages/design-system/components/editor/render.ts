import { Effect, Option, Schema } from "effect";
import katex from "katex";

/** The colour of a formula that cannot be drawn: the destructive token of the theme. */
const ERROR_COLOR = "var(--destructive)";

/** A formula that KaTeX does not parse, with the reason KaTeX gives. */
export class FormulaInvalid extends Schema.TaggedError<FormulaInvalid>()(
  "FormulaInvalid",
  { reason: Schema.String }
) {}

/**
 * The chemistry commands of KaTeX's mhchem extension, `\ce` and `\pu`, which a whole command name
 * does not extend: `\cell` is no chemistry.
 */
const CHEMISTRY = /\\(?:ce|pu)(?![a-zA-Z])/u;

/**
 * Whether a formula draws chemistry, which KaTeX draws only once its mhchem extension has loaded. The
 * extension is a separate module, so the view loads it on demand and no page loads it for a formula
 * that holds no chemistry.
 */
export const needsChemistry = (latex: string): boolean => CHEMISTRY.test(latex);

/**
 * The markup of a formula, drawn by KaTeX. A formula that does not parse is drawn as KaTeX's
 * error, in the destructive colour, so a broken formula never breaks the page around it.
 */
export function drawFormula(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, {
    displayMode,
    errorColor: ERROR_COLOR,
    throwOnError: false,
    trust: false,
  });
}

/** Checks that KaTeX parses a formula, and fails with its reason when it does not. */
export function checkFormula(
  latex: string
): Effect.Effect<void, FormulaInvalid> {
  return Effect.try({
    catch: (error) => new FormulaInvalid({ reason: String(error) }),
    try: () => {
      katex.renderToString(latex, { throwOnError: true, trust: false });
    },
  });
}

/** The reason a formula does not parse, or none when it parses. */
export function formulaProblem(
  latex: string
): Effect.Effect<Option.Option<string>> {
  return checkFormula(latex).pipe(
    Effect.match({
      onFailure: ({ reason }) => Option.some(reason),
      onSuccess: () => Option.none(),
    })
  );
}
