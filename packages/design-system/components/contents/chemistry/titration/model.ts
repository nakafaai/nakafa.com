import { Schema } from "effect";

/** What a burette can deliver. */
const TitrantSchema = Schema.Literals([
  "hydrochloric-acid",
  "sulfuric-acid",
  "sodium-hydroxide",
  "potassium-dichromate",
]);
export type Titrant = typeof TitrantSchema.Type;

/** What a conical flask can hold. */
const AnalyteSchema = Schema.Literals([
  "hydrochloric-acid",
  "sodium-hydroxide",
  "sodium-carbonate",
  "iron-sulfate",
]);
export type Analyte = typeof AnalyteSchema.Type;

/** The indicator in the flask; acidified dichromate needs none, it changes colour itself. */
const IndicatorSchema = Schema.Literals([
  "phenolphthalein",
  "methyl-orange",
  "none",
]);
export type Indicator = typeof IndicatorSchema.Type;

/** The colours a flask can show. */
const HueSchema = Schema.Literals([
  "colourless",
  "pink",
  "yellow",
  "orange",
  "red",
  "green",
  "pale-green",
]);
export type Hue = typeof HueSchema.Type;

/** One solution: what it is and its concentration in mol dm⁻³. */
const SolutionSchema = Schema.Struct({
  concentration: Schema.Finite,
});

/** The burette's solution. */
const TitrantSolutionSchema = Schema.Struct({
  ...SolutionSchema.fields,
  solute: TitrantSchema,
});

/** The flask's solution, with its volume in cm³. */
const AnalyteSolutionSchema = Schema.Struct({
  ...SolutionSchema.fields,
  solute: AnalyteSchema,
  volume: Schema.Finite,
});

/** One titration: the burette's solution, the flask's solution, and the indicator. */
const TitrationSchema = Schema.Struct({
  analyte: AnalyteSolutionSchema,
  indicator: IndicatorSchema,
  titrant: TitrantSolutionSchema,
});
export type Titration = typeof TitrationSchema.Type;

/** How one pair reacts: the moles of flask solute one mole of titrant uses, and its equation in LaTeX. */
const PairSchema = Schema.Struct({
  equation: Schema.String,
  ratio: Schema.Finite,
});
type Pair = typeof PairSchema.Type;

/** Each pair the lab can titrate, keyed `titrant/analyte`. */
const PAIRS: Record<string, Pair> = {
  "hydrochloric-acid/sodium-carbonate": {
    equation:
      "\\mathrm{Na_2CO_3} + 2\\mathrm{HCl} \\rightarrow 2\\mathrm{NaCl} + \\mathrm{CO_2} + \\mathrm{H_2O}",
    ratio: 1 / 2,
  },
  "hydrochloric-acid/sodium-hydroxide": {
    equation:
      "\\mathrm{NaOH} + \\mathrm{HCl} \\rightarrow \\mathrm{NaCl} + \\mathrm{H_2O}",
    ratio: 1,
  },
  "potassium-dichromate/iron-sulfate": {
    equation:
      "\\mathrm{Cr_2O_7^{2-}} + 14\\mathrm{H^+} + 6\\mathrm{Fe^{2+}} \\rightarrow 2\\mathrm{Cr^{3+}} + 6\\mathrm{Fe^{3+}} + 7\\mathrm{H_2O}",
    ratio: 6,
  },
  "sodium-hydroxide/hydrochloric-acid": {
    equation:
      "\\mathrm{HCl} + \\mathrm{NaOH} \\rightarrow \\mathrm{NaCl} + \\mathrm{H_2O}",
    ratio: 1,
  },
  "sulfuric-acid/sodium-hydroxide": {
    equation:
      "2\\mathrm{NaOH} + \\mathrm{H_2SO_4} \\rightarrow \\mathrm{Na_2SO_4} + 2\\mathrm{H_2O}",
    ratio: 2,
  },
};

/**
 * The hydrogen ions one mole of a strong acid releases, or the hydroxide
 * ions one mole of a strong base does, signed with acids positive. A solute
 * that is not a strong acid or base has none.
 */
const PROTONS = {
  "hydrochloric-acid": 1,
  "iron-sulfate": null,
  "potassium-dichromate": null,
  "sodium-carbonate": null,
  "sodium-hydroxide": -1,
  "sulfuric-acid": 2,
} satisfies Record<Analyte | Titrant, number | null>;

/** Each solute as LaTeX. */
export const SOLUTE_FORMULA = {
  "hydrochloric-acid": "\\mathrm{HCl}",
  "iron-sulfate": "\\mathrm{FeSO_4}",
  "potassium-dichromate": "\\mathrm{K_2Cr_2O_7}",
  "sodium-carbonate": "\\mathrm{Na_2CO_3}",
  "sodium-hydroxide": "\\mathrm{NaOH}",
  "sulfuric-acid": "\\mathrm{H_2SO_4}",
} satisfies Record<Analyte | Titrant, string>;

/** The pair a titration runs, when the lab knows it. */
export function pairOf(titration: Titration): Pair | undefined {
  return PAIRS[`${titration.titrant.solute}/${titration.analyte.solute}`];
}

/** The moles of solute in the flask. */
export function analyteMoles(titration: Titration) {
  return (titration.analyte.concentration * titration.analyte.volume) / 1000;
}

/**
 * The volume of titrant in cm³ that exactly reacts with the flask's solute:
 * its moles over the pair's ratio, over the titrant's concentration.
 */
export function endPoint(titration: Titration, pair: Pair) {
  return (
    ((analyteMoles(titration) / pair.ratio) * 1000) /
    titration.titrant.concentration
  );
}

/**
 * The pH after `added` cm³ of titrant, for a strong acid and a strong base:
 * the hydrogen or hydroxide ions left over, spread through the total volume,
 * and 7 where neither is left. A carbonate or a redox pair has no reading.
 */
export function phAfter(titration: Titration, added: number) {
  const titrant = PROTONS[titration.titrant.solute];
  const analyte = PROTONS[titration.analyte.solute];
  if (titrant === null || analyte === null) {
    return;
  }
  const acid =
    titrant * ((titration.titrant.concentration * added) / 1000) +
    analyte * analyteMoles(titration);
  const litres = (titration.analyte.volume + added) / 1000;
  const excess = Math.abs(acid) / litres;
  if (excess < 1e-12) {
    return 7;
  }
  return acid > 0 ? -Math.log10(excess) : 14 + Math.log10(excess);
}

/**
 * The colour of the flask after `added` cm³, before or past the end point.
 * Phenolphthalein is pink in alkali and colourless otherwise, methyl orange
 * yellow in alkali, orange at the end point and red in acid, and acidified
 * dichromate turns green as chromium(III) forms, then orange once it is in
 * excess. A flask with no indicator keeps its solution's own colour.
 */
export function hueAfter(titration: Titration, added: number): Hue {
  const pair = pairOf(titration);
  const end =
    pair === undefined ? Number.POSITIVE_INFINITY : endPoint(titration, pair);
  const past = added > end + 1e-9;
  const at = Math.abs(added - end) <= 1e-9;
  const flaskIsBase =
    titration.analyte.solute === "sodium-hydroxide" ||
    titration.analyte.solute === "sodium-carbonate";
  const alkaline = flaskIsBase ? !(past || at) : past;
  if (titration.indicator === "phenolphthalein") {
    return alkaline ? "pink" : "colourless";
  }
  if (titration.indicator === "methyl-orange") {
    if (at) {
      return "orange";
    }
    return alkaline ? "yellow" : "red";
  }
  if (titration.titrant.solute === "potassium-dichromate") {
    if (past) {
      return "orange";
    }
    return added > 0 ? "green" : "pale-green";
  }
  return titration.analyte.solute === "iron-sulfate"
    ? "pale-green"
    : "colourless";
}
