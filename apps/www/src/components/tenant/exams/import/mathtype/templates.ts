import { Array as Arr, Option, Record as Rec } from "effect";
import {
  fieldOf,
  hasFlag,
} from "@/components/tenant/exams/import/mathtype/flags";

/**
 * The fences of selectors 0 to 7, which stretch to their contents: angle brackets, parentheses,
 * braces, brackets, bars, double bars, floor and ceiling.
 */
const FENCES = [
  ["\\langle", "\\rangle"],
  ["(", ")"],
  ["\\{", "\\}"],
  ["[", "]"],
  ["|", "|"],
  ["\\|", "\\|"],
  ["\\lfloor", "\\rfloor"],
  ["\\lceil", "\\rceil"],
] as const;

/** The fences an interval chooses on each side, by the two bits it gives that side. */
const INTERVAL = ["(", ")", "[", "]"];

/**
 * The integrals by their loop bits and then their number of signs: plain, and around a loop. A
 * loop with a direction, clockwise or not, has no LaTeX form.
 */
const INTEGRAL_FAMILIES = [
  ["\\int", "\\iint", "\\iiint"],
  ["\\oint", "\\oiint", "\\oiiint"],
];

/** The big operators of selectors 16 to 20: sum, product, coproduct, union and intersection. */
const BIG_OPERATORS: Rec.ReadonlyRecord<string, string> = {
  16: "\\sum",
  17: "\\prod",
  18: "\\coprod",
  19: "\\bigcup",
  20: "\\bigcap",
};

/** The big form of an operator that a free big-operator template draws from its own slot. */
const BIG_FORMS: Rec.ReadonlyRecord<string, string> = {
  "\\cap": "\\bigcap",
  "\\cup": "\\bigcup",
  "\\oplus": "\\bigoplus",
  "\\otimes": "\\bigotimes",
  "\\vee": "\\bigvee",
  "\\wedge": "\\bigwedge",
};

/** The operators that already are big operators in LaTeX. */
const BIG_COMMANDS = [
  "\\sum",
  "\\prod",
  "\\coprod",
  "\\int",
  "\\iint",
  "\\iiint",
  "\\oint",
];

/**
 * The variation bits a template uses: a fence's left and right sides, which other templates read
 * as their first and second option, and the summation-style limits of a big operator.
 */
const LEFT = 0x1;
const RIGHT = 0x2;
const SUMMATION_LIMITS = 0x40;

/** A superscript of apostrophes alone, which MathType users type for primes. */
const ONLY_PRIMES = /^'+$/;

/** A slot that holds one letter or one command, which takes the short vector arrow. */
const SINGLE_SYMBOL = /^(?:[A-Za-z]|\\[A-Za-z]+)$/;

/** A template that follows its base, as a script does, and one that stands as a part of its own. */
const script = (latex: string) => ({ latex, script: true });
const part = (latex: string) => ({ latex, script: false });

/** The scripts of a limit, leaving out the empty ones. */
const limitsOf = (lower: string, upper: string) =>
  `${lower === "" ? "" : `_{${lower}}`}${upper === "" ? "" : `^{${upper}}`}`;

/** Whether a variation sets a bit. */
const has = hasFlag;

/** The LaTeX of a template with its variation and the LaTeX of its slots, in their stream order. */
type Template = (
  variation: number,
  slot: (index: number) => string
) => Option.Option<ReturnType<typeof part>>;

/** A fence template: each side drawn when the variation says the fence is there. */
const fence =
  ([open, close]: (typeof FENCES)[number]): Template =>
  (variation, slot) =>
    Option.some(
      part(
        `\\left${has(variation, LEFT) ? open : "."} ${slot(0)} \\right${has(variation, RIGHT) ? close : "."}`
      )
    );

/** A big operator with its limits beside it, or above and below it as a summation sets them. */
const bigOperator =
  (command: string): Template =>
  (variation, slot) =>
    Option.some(
      part(
        `${command}${has(variation, SUMMATION_LIMITS) ? "\\limits" : "\\nolimits"}${limitsOf(slot(1), slot(2))}${slot(0) === "" ? "" : ` ${slot(0)}`}`
      )
    );

/** A template that wraps its main slot in one command. */
const wrap =
  (command: string): Template =>
  (_variation, slot) =>
    Option.some(part(`${command}{${slot(0)}}`));

/** A template that wraps its main slot in one command, or twice when the variation doubles it. */
const bar =
  (command: string): Template =>
  (variation, slot) =>
    Option.some(
      part(
        has(variation, LEFT)
          ? `${command}{${command}{${slot(0)}}}`
          : `${command}{${slot(0)}}`
      )
    );

/** A horizontal brace over or under its main slot, with its label on the same side. */
const brace: Template = (variation, slot) =>
  Option.some(
    part(
      has(variation, LEFT)
        ? `\\overbrace{${slot(0)}}^{${slot(1)}}`
        : `\\underbrace{${slot(0)}}_{${slot(1)}}`
    )
  );

/** A script template: after its base, or before the item that follows when the variation says so. */
const scripts =
  (lower: boolean, upper: boolean): Template =>
  (variation, slot) => {
    const latex = limitsOf(
      lower ? slot(0) : "",
      upper
        ? slot(1).replace(ONLY_PRIMES, (primes) =>
            "\\prime".repeat(primes.length)
          )
        : ""
    );
    return Option.some(
      has(variation, LEFT) ? part(`{}${latex}`) : script(latex)
    );
  };

/** The single arrows by their direction bits (none means right), and the double arrow and harpoon pair. */
const SINGLE_ARROWS = [
  "\\xrightarrow",
  "\\xleftarrow",
  "\\xrightarrow",
  "\\xleftrightarrow",
];
const PAIRED_ARROWS = ["\\xrightleftarrows", "\\xrightleftharpoons"];

/** The arrow of an arrow template: single in its direction, or a double arrow or harpoon pair. */
const arrowOf = (variation: number) => {
  const kind = fieldOf(variation, 0, 2);
  return kind === 0
    ? Arr.get(SINGLE_ARROWS, fieldOf(variation, 4, 2))
    : Arr.get(PAIRED_ARROWS, kind - 1);
};

/**
 * The arrow over or under a vector: left, right or both ways, or a harpoon over it. A vector
 * whose variation names no direction, or a harpoon under or both ways, has none.
 */
const vectorOf = (variation: number, main: string) => {
  const direction = fieldOf(variation, 0, 2) - 1;
  const under = has(variation, 0x4);
  if (has(variation, 0x8)) {
    return under
      ? Option.none()
      : Arr.get(["\\overleftharpoon", "\\overrightharpoon"], direction);
  }
  if (direction === 1 && !under && SINGLE_SYMBOL.test(main)) {
    return Option.some("\\vec");
  }
  return Arr.get(
    under
      ? ["\\underleftarrow", "\\underrightarrow", "\\underleftrightarrow"]
      : ["\\overleftarrow", "\\overrightarrow", "\\overleftrightarrow"],
    direction
  );
};

/** The command of a free big operator from the LaTeX of its operator slot. */
const freeOperator = (operator: string) =>
  Option.getOrElse(Rec.get(BIG_FORMS, operator), () =>
    Arr.contains(BIG_COMMANDS, operator) ? operator : `\\mathop{${operator}}`
  );

/**
 * Every template this reader writes, by its selector in MTEF 5. Each reads its slots in the
 * order MathType writes them, which the fixtures of real MathType 6 files settle where the
 * published description differs: a big operator holds its main slot, then the lower limit, then
 * the upper one. Long division, the joint status mark and any selector not listed keep their
 * equation as a picture.
 */
const TEMPLATES: Rec.ReadonlyRecord<string, Template> = {
  ...Rec.fromEntries(
    Arr.map(
      FENCES,
      (pair, selector) => [String(selector), fence(pair)] as const
    )
  ),
  8: (variation, slot) =>
    Option.some(
      part(
        `${has(variation, LEFT) ? "\\llbracket " : ""}${slot(0)}${has(variation, RIGHT) ? " \\rrbracket" : ""}`
      )
    ),
  9: (variation, slot) =>
    Option.all([
      Arr.get(INTERVAL, fieldOf(variation, 0, 2)),
      Arr.get(INTERVAL, fieldOf(variation, 4, 2)),
    ]).pipe(
      Option.map(([open, close]) =>
        part(`\\left${open} ${slot(0)} \\right${close}`)
      )
    ),
  10: (variation, slot) =>
    Option.some(
      part(
        has(variation, LEFT)
          ? `\\sqrt[${slot(1)}]{${slot(0)}}`
          : `\\sqrt{${slot(0)}}`
      )
    ),
  11: (variation, slot) =>
    Option.some(
      part(
        has(variation, RIGHT)
          ? `{${slot(0)}}/{${slot(1)}}`
          : `\\${has(variation, LEFT) ? "tfrac" : "frac"}{${slot(0)}}{${slot(1)}}`
      )
    ),
  12: bar("\\underline"),
  13: bar("\\overline"),
  14: (variation, slot) =>
    Option.map(arrowOf(variation), (arrow) =>
      part(`${arrow}${slot(1) === "" ? "" : `[${slot(1)}]`}{${slot(0)}}`)
    ),
  15: (variation, slot) =>
    Arr.get(INTEGRAL_FAMILIES, fieldOf(variation, 2, 2)).pipe(
      Option.flatMap((family) => Arr.get(family, fieldOf(variation, 0, 2) - 1)),
      Option.flatMap((command) => bigOperator(command)(variation, slot))
    ),
  ...Rec.map(BIG_OPERATORS, bigOperator),
  21: (variation, slot) => bigOperator(freeOperator(slot(3)))(variation, slot),
  22: (variation, slot) => bigOperator(freeOperator(slot(3)))(variation, slot),
  23: (_variation, slot) =>
    Option.some(
      part(`\\mathop{${slot(0)}}\\limits${limitsOf(slot(1), slot(2))}`)
    ),
  24: brace,
  25: brace,
  27: scripts(true, false),
  28: scripts(false, true),
  29: scripts(true, true),
  30: (variation, slot) =>
    Option.some(
      part(
        `${has(variation, LEFT) ? `\\langle ${slot(0)} ` : ""}\\vert${has(variation, RIGHT) ? ` ${slot(1)} \\rangle` : ""}`
      )
    ),
  31: (variation, slot) =>
    Option.map(vectorOf(variation, slot(0)), (command) =>
      part(`${command}{${slot(0)}}`)
    ),
  32: wrap("\\widetilde"),
  33: wrap("\\widehat"),
  34: (_variation, slot) => Option.some(part(`\\overset{\\frown}{${slot(0)}}`)),
  36: (variation, slot) =>
    Option.map(
      Rec.get(
        { 2: "\\cancel", 4: "\\bcancel", 6: "\\xcancel" },
        String(variation)
      ),
      (command) => part(`${command}{${slot(0)}}`)
    ),
  37: wrap("\\boxed"),
};

/**
 * The LaTeX of one template from its selector, its variation and the LaTeX of its slots in
 * stream order, with whether it is a script that follows its base. None for a template this
 * reader does not write.
 */
export const templateLatex = (
  selector: number,
  variation: number,
  slots: readonly string[]
) =>
  Option.flatMap(Rec.get(TEMPLATES, String(selector)), (template) =>
    template(variation, (index) =>
      Option.getOrElse(Arr.get(slots, index), () => "")
    )
  );
