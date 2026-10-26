import { Array as Arr, Option, Record as Rec } from "effect";

/**
 * The LaTeX of each character MathType writes that is not drawn as itself, by the character. MTCode
 * is Unicode, apart from MathType's own private codes, so the table is keyed by the character.
 */
const MATH: Rec.ReadonlyRecord<string, string> = {
  " ": "\\ ",
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  "\\": "\\backslash",
  "^": "\\hat{}",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\sim",
  "¬": "\\neg",
  "°": "^{\\circ}",
  "±": "\\pm",
  "·": "\\cdot",
  "×": "\\times",
  "÷": "\\div",
  Γ: "\\Gamma",
  Δ: "\\Delta",
  Θ: "\\Theta",
  Λ: "\\Lambda",
  Ξ: "\\Xi",
  Π: "\\Pi",
  Σ: "\\Sigma",
  Υ: "\\Upsilon",
  Φ: "\\Phi",
  Ψ: "\\Psi",
  Ω: "\\Omega",
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  ε: "\\varepsilon",
  ζ: "\\zeta",
  η: "\\eta",
  θ: "\\theta",
  ι: "\\iota",
  κ: "\\kappa",
  λ: "\\lambda",
  μ: "\\mu",
  ν: "\\nu",
  ξ: "\\xi",
  ο: "o",
  π: "\\pi",
  ρ: "\\rho",
  ς: "\\varsigma",
  σ: "\\sigma",
  τ: "\\tau",
  υ: "\\upsilon",
  φ: "\\varphi",
  χ: "\\chi",
  ψ: "\\psi",
  ω: "\\omega",
  ϑ: "\\vartheta",
  ϕ: "\\phi",
  ϖ: "\\varpi",
  ϱ: "\\varrho",
  ϵ: "\\epsilon",
  "‖": "\\|",
  "•": "\\bullet",
  "…": "\\ldots",
  "′": "\\prime",
  "″": "\\prime\\prime",
  "‴": "\\prime\\prime\\prime",
  ℂ: "\\mathbb{C}",
  ℋ: "\\mathcal{H}",
  ℌ: "\\mathfrak{H}",
  ℍ: "\\mathbb{H}",
  ℏ: "\\hbar",
  ℐ: "\\mathcal{I}",
  ℑ: "\\Im",
  ℒ: "\\mathcal{L}",
  ℓ: "\\ell",
  ℕ: "\\mathbb{N}",
  ℙ: "\\mathbb{P}",
  ℚ: "\\mathbb{Q}",
  ℛ: "\\mathcal{R}",
  ℜ: "\\Re",
  ℝ: "\\mathbb{R}",
  ℤ: "\\mathbb{Z}",
  ℨ: "\\mathfrak{Z}",
  ℬ: "\\mathcal{B}",
  ℭ: "\\mathfrak{C}",
  ℰ: "\\mathcal{E}",
  ℱ: "\\mathcal{F}",
  ℳ: "\\mathcal{M}",
  ℵ: "\\aleph",
  "←": "\\leftarrow",
  "↑": "\\uparrow",
  "→": "\\to",
  "↓": "\\downarrow",
  "↔": "\\leftrightarrow",
  "↕": "\\updownarrow",
  "↦": "\\mapsto",
  "↼": "\\leftharpoonup",
  "↽": "\\leftharpoondown",
  "⇀": "\\rightharpoonup",
  "⇁": "\\rightharpoondown",
  "⇄": "\\rightleftarrows",
  "⇆": "\\leftrightarrows",
  "⇋": "\\leftrightharpoons",
  "⇌": "\\rightleftharpoons",
  "⇐": "\\Leftarrow",
  "⇑": "\\Uparrow",
  "⇒": "\\Rightarrow",
  "⇓": "\\Downarrow",
  "⇔": "\\Leftrightarrow",
  "∀": "\\forall",
  "∂": "\\partial",
  "∃": "\\exists",
  "∄": "\\nexists",
  "∅": "\\emptyset",
  "∆": "\\Delta",
  "∇": "\\nabla",
  "∈": "\\in",
  "∉": "\\notin",
  "∋": "\\ni",
  "∏": "\\prod",
  "∐": "\\coprod",
  "∑": "\\sum",
  "−": "-",
  "∓": "\\mp",
  "∕": "/",
  "∗": "\\ast",
  "∘": "\\circ",
  "∙": "\\bullet",
  "√": "\\surd",
  "∝": "\\propto",
  "∞": "\\infty",
  "∠": "\\angle",
  "∡": "\\measuredangle",
  "∣": "\\mid",
  "∥": "\\parallel",
  "∧": "\\wedge",
  "∨": "\\vee",
  "∩": "\\cap",
  "∪": "\\cup",
  "∫": "\\int",
  "∬": "\\iint",
  "∭": "\\iiint",
  "∮": "\\oint",
  "∴": "\\therefore",
  "∵": "\\because",
  "∼": "\\sim",
  "≃": "\\simeq",
  "≅": "\\cong",
  "≈": "\\approx",
  "≠": "\\neq",
  "≡": "\\equiv",
  "≤": "\\le",
  "≥": "\\ge",
  "≦": "\\leqq",
  "≧": "\\geqq",
  "≪": "\\ll",
  "≫": "\\gg",
  "≮": "\\nless",
  "≯": "\\ngtr",
  "≰": "\\nleq",
  "≱": "\\ngeq",
  "⊂": "\\subset",
  "⊃": "\\supset",
  "⊄": "\\not\\subset",
  "⊆": "\\subseteq",
  "⊇": "\\supseteq",
  "⊈": "\\nsubseteq",
  "⊉": "\\nsupseteq",
  "⊊": "\\subsetneq",
  "⊋": "\\supsetneq",
  "⊕": "\\oplus",
  "⊗": "\\otimes",
  "⊥": "\\perp",
  "⋅": "\\cdot",
  "⋮": "\\vdots",
  "⋯": "\\cdots",
  "⋱": "\\ddots",
  "⌈": "\\lceil",
  "⌉": "\\rceil",
  "⌊": "\\lfloor",
  "⌋": "\\rfloor",
  "〈": "\\langle",
  "〉": "\\rangle",
  "△": "\\triangle",
  "⟨": "\\langle",
  "⟩": "\\rangle",
  "⟶": "\\longrightarrow",
  "⟹": "\\Longrightarrow",
};

/**
 * The characters a reader of the source cannot see, by their code: Unicode's spaces and invisible
 * operators, and MathType's private codes, its spaces from the zero space to the two-em space and
 * the relations and letters it keeps outside Unicode.
 */
const CODES = [
  [0x00_a0, "~"],
  [0x20_02, "\\enspace"],
  [0x20_03, "\\quad"],
  [0x20_09, "\\,"],
  [0x20_0a, "\\,"],
  [0x20_0b, ""],
  [0x20_61, ""],
  [0x20_62, ""],
  [0x20_63, ""],
  [0xe9_0b, "\\supseteq"],
  [0xe9_0c, "\\subseteq"],
  [0xe9_32, "\\lesssim"],
  [0xe9_33, "\\gtrsim"],
  [0xe9_8f, "\\cdot"],
  [0xea_06, "\\nleq"],
  [0xea_07, "\\ngeq"],
  [0xea_0b, "\\nsupseteq"],
  [0xea_0c, "\\nsubseteq"],
  [0xea_34, "\\lneq"],
  [0xea_35, "\\gneq"],
  [0xea_42, "\\nsubseteq"],
  [0xea_43, "\\nsupseteq"],
  [0xea_44, "\\subsetneqq"],
  [0xea_45, "\\supsetneqq"],
  [0xed_10, "\\mathrm{d}"],
  [0xed_11, "\\mathrm{e}"],
  [0xed_12, "\\mathrm{i}"],
  [0xed_13, "\\mathrm{j}"],
  [0xed_16, "\\mathrm{D}"],
  [0xee_19, "\\prime\\prime\\prime\\prime"],
  [0xef_00, ""],
  [0xef_01, ""],
  [0xef_02, "\\,"],
  [0xef_03, "\\:"],
  [0xef_04, "\\;"],
  [0xef_05, "\\quad"],
  [0xef_06, "\\qquad"],
  [0xef_08, "\\,"],
  [0xfe_ff, ""],
] as const;

/**
 * The private ranges in which MathType keeps whole alphabets: Fraktur, double-struck and script
 * capitals and small letters, and double-struck digits, each from its first code.
 */
const ALPHABETS = [
  { command: "\\mathfrak", count: 25, first: "A", from: 0xf0_00 },
  { command: "\\mathfrak", count: 26, first: "a", from: 0xf0_1a },
  { command: "\\mathbb", count: 25, first: "A", from: 0xf0_80 },
  { command: "\\mathbb", count: 10, first: "0", from: 0xf0_c0 },
  { command: "\\mathcal", count: 26, first: "A", from: 0xf1_00 },
];

/** The relations a pile aligned at its relations lines up on. */
const RELATIONS = [
  "=",
  "<",
  ">",
  "\\neq",
  "\\le",
  "\\ge",
  "\\leqq",
  "\\geqq",
  "\\approx",
  "\\equiv",
  "\\sim",
  "\\simeq",
  "\\cong",
  "\\propto",
  "\\in",
  "\\notin",
  "\\subset",
  "\\supset",
  "\\subseteq",
  "\\supseteq",
  "\\to",
  "\\Rightarrow",
  "\\Leftrightarrow",
  "\\ll",
  "\\gg",
];

/** The function names LaTeX sets upright by its own command. */
const FUNCTIONS = [
  "arccos",
  "arcsin",
  "arctan",
  "arg",
  "cos",
  "cosh",
  "cot",
  "coth",
  "csc",
  "deg",
  "det",
  "dim",
  "exp",
  "gcd",
  "hom",
  "inf",
  "ker",
  "lg",
  "lim",
  "liminf",
  "limsup",
  "ln",
  "log",
  "max",
  "min",
  "Pr",
  "sec",
  "sin",
  "sinh",
  "sup",
  "tan",
  "tanh",
];

/** The no-break space, which text mode writes as a plain space. */
const NO_BREAK_SPACE = 0x00_a0;

/** The characters that text mode writes with a command. */
const TEXT: Rec.ReadonlyRecord<string, string> = {
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  "\\": "\\textbackslash{}",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
};

/** The LaTeX of a character the code table holds. */
const codeSymbol = (code: number) =>
  Option.map(
    Arr.findFirst(CODES, ([known]) => known === code),
    ([, latex]) => latex
  );

/** Whether a code is one of the private codes Unicode leaves to programs such as MathType. */
const isPrivate = (code: number) => code >= 0xe0_00 && code <= 0xf8_ff;

/** Whether a code is a control character, which no equation draws. */
const isControl = (code: number) => code < 0x20 || code === 0x7f;

/**
 * The LaTeX of a character in math mode: printable ASCII as itself unless LaTeX reserves it,
 * other characters by the tables, and none for a private or control code the tables do not know,
 * since a guessed glyph would change the mathematics. Any other Unicode character is written as
 * itself, which KaTeX draws.
 */
export const mathSymbol = (code: number): Option.Option<string> => {
  const character = String.fromCharCode(code);
  const named = Rec.get(MATH, character).pipe(
    Option.orElse(() => codeSymbol(code)),
    Option.orElse(() =>
      Option.map(
        Arr.findFirst(
          ALPHABETS,
          (alphabet) =>
            code >= alphabet.from && code < alphabet.from + alphabet.count
        ),
        (alphabet) =>
          `${alphabet.command}{${String.fromCharCode(alphabet.first.charCodeAt(0) + code - alphabet.from)}}`
      )
    )
  );
  if (Option.isSome(named) || isPrivate(code) || isControl(code)) {
    return named;
  }
  return Option.some(character);
};

/** The text-mode LaTeX of a character, or none for a private or control code. */
export const textSymbol = (code: number): Option.Option<string> => {
  if (isPrivate(code) || isControl(code)) {
    return Option.none();
  }
  if (code === NO_BREAK_SPACE) {
    return Option.some(" ");
  }
  const character = String.fromCharCode(code);
  return Option.some(
    Option.getOrElse(Rec.get(TEXT, character), () => character)
  );
};

/** Whether the LaTeX of a character is a relation, where a pile aligned at its relations lines up. */
export const isRelation = (latex: string) => Arr.contains(RELATIONS, latex);

/** A function name: its own LaTeX command when LaTeX has one, or an upright operator name. */
export const functionName = (name: string) =>
  Arr.contains(FUNCTIONS, name) ? `\\${name}` : `\\operatorname{${name}}`;

/**
 * The marks MathType sets on one character, by their number in MTEF 5, each as the LaTeX that
 * wraps or follows the character. The marks LaTeX has no form for (a mid bar, dots or arcs below
 * a character) are left out, so a character that carries one keeps its equation as a picture.
 */
const EMBELLISHMENTS: Rec.ReadonlyRecord<string, (base: string) => string> = {
  2: (base) => `\\dot{${base}}`,
  3: (base) => `\\ddot{${base}}`,
  4: (base) => `\\dddot{${base}}`,
  5: (base) => `${base}'`,
  6: (base) => `${base}''`,
  7: (base) => `${base}^{\\backprime}`,
  8: (base) => `\\tilde{${base}}`,
  9: (base) => `\\hat{${base}}`,
  10: (base) => `\\not ${base}`,
  11: (base) => `\\vec{${base}}`,
  12: (base) => `\\overleftarrow{${base}}`,
  13: (base) => `\\overleftrightarrow{${base}}`,
  14: (base) => `\\overrightharpoon{${base}}`,
  15: (base) => `\\overleftharpoon{${base}}`,
  17: (base) => `\\bar{${base}}`,
  18: (base) => `${base}'''`,
  19: (base) => `\\overset{\\frown}{${base}}`,
  20: (base) => `\\overset{\\smile}{${base}}`,
  21: (base) => `\\xcancel{${base}}`,
  22: (base) => `\\cancel{${base}}`,
  23: (base) => `\\bcancel{${base}}`,
  24: (base) => `\\ddddot{${base}}`,
  29: (base) => `\\underline{${base}}`,
  30: (base) => `\\utilde{${base}}`,
  33: (base) => `\\underrightarrow{${base}}`,
  34: (base) => `\\underleftarrow{${base}}`,
  35: (base) => `\\underleftrightarrow{${base}}`,
};

/** A character with its marks in the order MathType lists them, or none when one has no LaTeX. */
export const embellish = (
  base: string,
  marks: readonly number[]
): Option.Option<string> =>
  Arr.reduce(marks, Option.some(base), (latex, mark) =>
    Option.flatMap(latex, (inner) =>
      Option.map(Rec.get(EMBELLISHMENTS, String(mark)), (wrap) => wrap(inner))
    )
  );
