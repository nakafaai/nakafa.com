import { Array as Arr, Option, Schema, String as Str } from "effect";

/**
 * How a formula or a unit is set in print: `H₂O`, `SO₄²⁻`, `dm³`. An author
 * writes the subscripts and superscripts as their own characters, and the
 * print sets each as a smaller figure moved off the baseline, by the
 * measures KaTeX sets `\mathrm{H_2O}` with, so a label on a bottle and a
 * formula in the lesson's text agree.
 */

/** A run of characters on one level: below the baseline, on it, or above it. */
const RunSchema = Schema.Struct({
  level: Schema.Literals([-1, 0, 1]),
  text: Schema.String,
});
type Run = typeof RunSchema.Type;

/** A run with its place: its type size, where it starts, and how far it stands above the baseline. */
const SetSchema = Schema.Struct({
  lift: Schema.Finite,
  size: Schema.Finite,
  text: Schema.String,
  x: Schema.Finite,
});

/** A text set in one line: its runs in their places, and the width of the whole. */
const LineSchema = Schema.Struct({
  runs: Schema.Array(SetSchema),
  width: Schema.Finite,
});

/** The size of a subscript or superscript against its base, KaTeX's script style. */
const SCRIPT = 0.7;

/** How far a superscript rises and a subscript drops, in em of the base (KaTeX's `sup2` and `sub1`). */
const SHIFT = { [-1]: -0.15, 0: 0, 1: 0.363 } as const;

/** Each subscript character and the plain character it is set as. */
const SUBSCRIPTS = "₀0₁1₂2₃3₄4₅5₆6₇7₈8₉9₊+₋−₌=₍(₎)ₐaₑeₕhₖkₗlₘmₙnₒoₚpₛsₜtₓx";

/** Each superscript character and the plain character it is set as. */
const SUPERSCRIPTS = "⁰0¹1²2³3⁴4⁵5⁶6⁷7⁸8⁹9⁺+⁻−⁼=⁽(⁾)ⁿn";

/** The plain character a script character stands for, from a string of pairs. */
function plain(pairs: string, character: string): Option.Option<string> {
  const at = pairs.indexOf(character);
  return at >= 0 && at % 2 === 0
    ? Option.fromNullishOr(pairs[at + 1])
    : Option.none();
}

/** One character as a run of its own, on the level its form says. */
function runOf(character: string): Run {
  return Option.match(plain(SUBSCRIPTS, character), {
    onNone: () =>
      Option.match(plain(SUPERSCRIPTS, character), {
        onNone: () => ({ level: 0 as const, text: character }),
        onSome: (text) => ({ level: 1 as const, text }),
      }),
    onSome: (text) => ({ level: -1 as const, text }),
  });
}

/** A text as runs: neighbouring characters on one level joined, each script character made plain. */
export function formulaRuns(text: string): readonly Run[] {
  return Arr.reduce(
    Arr.map(Arr.filter(Str.split(text, ""), Str.isNonEmpty), runOf),
    Arr.empty<Run>(),
    (runs, run) =>
      Option.match(
        Option.filter(Arr.last(runs), (last) => last.level === run.level),
        {
          onNone: () => Arr.append(runs, run),
          onSome: (last) =>
            Arr.append(Arr.dropRight(runs, 1), {
              level: last.level,
              text: `${last.text}${run.text}`,
            }),
        }
      )
  );
}

/**
 * Sets a text's runs in a line from x = 0 at a type size: each run's size,
 * where it starts and how far it stands above the baseline, and the width of
 * the whole. `measure` gives the width of a text at a size.
 */
export function setFormula(
  text: string,
  size: number,
  measure: (text: string, size: number) => number
): typeof LineSchema.Type {
  return Arr.reduce(
    formulaRuns(text),
    { runs: Arr.empty<typeof SetSchema.Type>(), width: 0 },
    (line, run) => {
      const runSize = run.level === 0 ? size : size * SCRIPT;
      return {
        runs: Arr.append(line.runs, {
          lift: SHIFT[run.level] * size,
          size: runSize,
          text: run.text,
          x: line.width,
        }),
        width: line.width + measure(run.text, runSize),
      };
    }
  );
}
