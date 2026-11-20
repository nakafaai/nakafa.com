import { Array as Arr, Option, Record as Rec, String as Str } from "effect";

/**
 * The most characters the grader reads of one expression. A derivative or a simplified term of an exam
 * fits in far fewer, so a longer text is refused before any work, whoever typed it.
 */
export const SOURCE_MAX = 300;

/** The most tokens the grader reads of one expression: one per digit, letter, sign, or command. */
export const TOKENS_MAX = 200;

/** Characters a phone keyboard or a pasted document gives, spelled as the LaTeX they stand for. */
const UNICODE: Record<string, string> = {
  "²": "^2",
  "³": "^3",
  "·": "*",
  "×": "*",
  "÷": "/",
  "π": "\\pi ",
  "–": "-",
  "′": "'",
  "−": "-",
  "√": "\\sqrt ",
  "⋅": "*",
};

/** A decimal comma between two digits, as German, Indonesian, and Malay write `0{,}5` or `0,5`. */
const DECIMAL_COMMA = /(?<digit>\d)(?:\{,\}|,)(?=\d)/gu;

/**
 * One token of the source. In order: spacing the grader reads past; a word that `\mathrm` or
 * `\operatorname` sets upright, such as `\mathrm{e}`; a command; a function typed without a
 * backslash and called with a bracket, as `sin(x)` or `sqrt(x)` on a keyboard; one digit, letter, or
 * sign; and any other character, which the grader refuses.
 */
const TOKEN_PATTERN =
  /(?<skip>\s+|\\[,;:! ]|~)|\\(?:mathrm|mathit|operatorname|text|textrm)\s*\{\s*(?<word>[A-Za-z]+)\s*\}|\\(?<command>[A-Za-z]+)|(?<call>arcsin|arccos|arctan|sinh|cosh|tanh|sqrt|sin|cos|tan|cot|sec|csc|exp|abs|ln|lg|log)(?=\s*\()|(?<single>[\dA-Za-z.+\-*/^_(){}[\]|='])|(?<other>[\s\S])/gu;

/** The functions the grader reads, by the name a command or a typed call gives them. */
export const FUNCTION_NAMES = [
  "abs",
  "arccos",
  "arcsin",
  "arctan",
  "cos",
  "cosh",
  "cot",
  "csc",
  "exp",
  "lg",
  "ln",
  "log",
  "sec",
  "sin",
  "sinh",
  "tan",
  "tanh",
] as const;

/** The Greek letters the grader reads as variables, such as an angle `\theta`. */
export const GREEK = [
  "alpha",
  "beta",
  "gamma",
  "lambda",
  "mu",
  "omega",
  "phi",
  "rho",
  "sigma",
  "tau",
  "theta",
  "varphi",
] as const;

/** Commands that only space or size what follows, as `\left(` sizes its bracket. */
const SPACING = [
  "Big",
  "Bigg",
  "Biggl",
  "Biggr",
  "Bigl",
  "Bigr",
  "big",
  "bigg",
  "biggl",
  "biggr",
  "bigl",
  "bigr",
  "displaystyle",
  "left",
  "mleft",
  "mright",
  "qquad",
  "quad",
  "right",
  "textstyle",
] as const;

/** Commands that spell a sign or a symbol another token already names. */
const ALIASES: Record<string, string> = {
  ast: "*",
  cdot: "*",
  dfrac: "\\frac",
  div: "/",
  exponentialE: "e",
  lvert: "|",
  prime: "'",
  rvert: "|",
  tfrac: "\\frac",
  times: "*",
  vert: "|",
};

/** The command token of a name: a function, a Greek letter, `\frac`, `\sqrt`, or `\pi`. */
const commandOf = (name: string): Option.Option<readonly string[]> => {
  if (Arr.contains(SPACING, name)) {
    return Option.some([]);
  }
  const alias = Rec.get(ALIASES, name);
  if (Option.isSome(alias)) {
    return Option.some([alias.value]);
  }
  return Arr.contains(FUNCTION_NAMES, name) ||
    Arr.contains(GREEK, name) ||
    Arr.contains(["frac", "sqrt", "pi"], name)
    ? Option.some([`\\${name}`])
    : Option.none();
};

/**
 * The tokens one match stands for: none for spacing, one for a sign, a typed call, or a known command,
 * a letter or a command for an upright word, and a refusal for any other character.
 */
const tokensOf = (match: RegExpMatchArray): Option.Option<readonly string[]> => {
  const { call, command, single, skip, word } = match.groups ?? {};
  if (skip !== undefined) {
    return Option.some([]);
  }
  if (single !== undefined) {
    return Option.some([single]);
  }
  if (call !== undefined) {
    return Option.some([`\\${call}`]);
  }
  if (command !== undefined) {
    return commandOf(command);
  }
  if (word !== undefined) {
    return word.length === 1 ? Option.some([word]) : commandOf(word);
  }
  return Option.none();
};

/**
 * Splits a typed or authored expression into tokens: each digit, letter, and sign alone, and each
 * command by name, so `\frac12` reads as LaTeX reads it. Spacing and sizing commands disappear,
 * Unicode signs and a decimal comma become their LaTeX, and a text that is empty, longer than
 * `SOURCE_MAX`, more than `TOKENS_MAX` tokens, or holds anything the grader does not read is refused.
 */
export const tokenize = (source: string): Option.Option<readonly string[]> => {
  const text = Str.trim(source);
  if (text.length > SOURCE_MAX) {
    return Option.none();
  }
  const spelled = Arr.reduce(
    Rec.toEntries(UNICODE),
    text,
    (spelling, [character, latex]) => Str.replaceAll(character, latex)(spelling)
  ).replace(DECIMAL_COMMA, "$<digit>.");
  return Option.flatMap(
    Option.all(Arr.map(Arr.fromIterable(spelled.matchAll(TOKEN_PATTERN)), tokensOf)),
    (pieces) => {
      const tokens = Arr.flatten(pieces);
      return Arr.isReadonlyArrayNonEmpty(tokens) && tokens.length <= TOKENS_MAX
        ? Option.some(tokens)
        : Option.none();
    }
  );
};
