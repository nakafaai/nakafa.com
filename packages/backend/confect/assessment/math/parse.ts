import type { Operator, Term } from "@repo/backend/confect/assessment/math/term";
import {
  integer,
  negate,
  reciprocal,
} from "@repo/backend/confect/assessment/math/term";
import { GREEK, tokenize } from "@repo/backend/confect/assessment/math/token";
import {
  Array as Arr,
  BigDecimal,
  Option,
  Rational,
  Record as Rec,
  String as Str,
} from "effect";

/** What one step of the parser reads: a term and the position of the token after it, or none. */
type Read = Option.Option<readonly [Term, number]>;

/**
 * The deepest the parser descends. Every step that can nest counts one, and every way back into the
 * grammar passes through `primary`, which stops here, so brackets, fractions, roots, and functions inside
 * each other are refused at about a dozen levels instead of exhausting the stack.
 */
const DEPTH_MAX = 96;

/** The most digits one number holds, so no typed number grows past exact arithmetic's budget. */
const DIGITS_MAX = 15;

/** The highest index of a root, as in `\sqrt[3]{x}`, and the highest power of a function, as in `\sin^2 x`. */
const INDEX_MAX = 12;

/** The token past the last one. */
const END = "";

/** The operator each function command applies. `\exp` raises `e`, and `\log` and `\lg` take a base. */
const FUNCTIONS: Record<string, Operator> = {
  "\\abs": "Abs",
  "\\arccos": "Arccos",
  "\\arcsin": "Arcsin",
  "\\arctan": "Arctan",
  "\\cos": "Cos",
  "\\cosh": "Cosh",
  "\\cot": "Cot",
  "\\csc": "Csc",
  "\\exp": "Power",
  "\\lg": "Log",
  "\\ln": "Ln",
  "\\log": "Log",
  "\\sec": "Sec",
  "\\sin": "Sin",
  "\\sinh": "Sinh",
  "\\tan": "Tan",
  "\\tanh": "Tanh",
};

const DIGIT = /^\d$/u;
const LETTER = /^[A-Za-z]$/u;

const peek = (tokens: readonly string[], position: number) =>
  Option.getOrElse(Arr.get(tokens, position), () => END);

const isDigit = (token: string) => DIGIT.test(token);

const isLetter = (token: string) => LETTER.test(token);

const isSign = (token: string) => token === "+" || token === "-";

/** Whether a token names a symbol by command: pi or a Greek variable. */
const isSymbolCommand = (token: string) =>
  token === "\\pi" ||
  (Str.startsWith("\\")(token) && Arr.contains(GREEK, token.slice(1)));

/** The symbol a command names: `pi` for `\pi`, and a Greek variable by its command. */
const symbolOf = (token: string) => (token === "\\pi" ? "pi" : token);

/** The one term of a single operand, or the operator applied to several. */
const joined = (operator: Operator, operands: readonly Term[]): Term =>
  operands.length === 1 ? operands[0] : [operator, ...operands];

/** How many digit tokens follow one another from a position. */
const digitsFrom = (tokens: readonly string[], start: number) => {
  let position = start;
  while (isDigit(peek(tokens, position))) {
    position += 1;
  }
  return position - start;
};

/** The text of the tokens from a position, as many as a count. */
const textOf = (tokens: readonly string[], start: number, count: number) =>
  Arr.join(Arr.take(Arr.drop(tokens, start), count), "");

/**
 * Whether a token starts a factor that multiplies the one before it, as `x` does in `3x`. A bar starts
 * one only outside a bar, where it opens an absolute value instead of closing one. Inside the argument of
 * a function written without brackets, another function starts the next factor of the product around it,
 * so `\sin x \cos x` is a product of two functions.
 */
const startsFactor = (token: string, bars: number, argument: boolean) =>
  isDigit(token) ||
  isLetter(token) ||
  isSymbolCommand(token) ||
  token === "(" ||
  token === "[" ||
  token === "{" ||
  token === "\\frac" ||
  token === "\\sqrt" ||
  (token === "|" && bars === 0) ||
  (Rec.has(FUNCTIONS, token) && !argument);

/** A number of digits with an optional decimal point, read exactly, so `0.5` is one half. */
const number = (tokens: readonly string[], start: number): Read => {
  const whole = digitsFrom(tokens, start);
  const point = peek(tokens, start + whole) === ".";
  const fraction = point ? digitsFrom(tokens, start + whole + 1) : 0;
  const length = whole + (point ? 1 + fraction : 0);
  if (whole + fraction > DIGITS_MAX || (point && fraction === 0)) {
    return Option.none();
  }
  const text = textOf(tokens, start, length);
  return Option.map(
    BigDecimal.fromString(whole === 0 ? `0${text}` : text),
    (value) => [Rational.fromBigDecimal(value), start + length] as const
  );
};

/** A letter, with the subscript that names a variable such as `x_0` or `a_{12}`. */
const symbol = (tokens: readonly string[], start: number): Read => {
  const letter = peek(tokens, start);
  if (peek(tokens, start + 1) !== "_") {
    return Option.some([letter, start + 1]);
  }
  const first = peek(tokens, start + 2);
  if (isDigit(first) || isLetter(first)) {
    return Option.some([`${letter}_${first}`, start + 3]);
  }
  let position = start + 3;
  while (isDigit(peek(tokens, position)) || isLetter(peek(tokens, position))) {
    position += 1;
  }
  const length = position - start - 3;
  return first === "{" && length > 0 && peek(tokens, position) === "}"
    ? Option.some([
        `${letter}_${textOf(tokens, start + 3, length)}`,
        position + 1,
      ])
    : Option.none();
};

/** A bracketed expression, which closes with its own bracket. A bar inside it opens a new absolute value. */
const group = (
  tokens: readonly string[],
  start: number,
  close: string,
  depth: number,
  bars: number
): Read =>
  Option.flatMap(sum(tokens, start + 1, depth + 1, bars), ([term, next]) =>
    peek(tokens, next) === close
      ? Option.some([term, next + 1])
      : Option.none()
  );

/**
 * One argument of a command or a power, as LaTeX reads it: a braced group, a single digit, letter, or
 * command, or a bracketed group typed on a keyboard. So `x^23` is `x^2` times 3, and `\frac12` is one
 * half. An exponent may carry a sign, as `x^-1` is typed.
 */
const argument = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number,
  signed: boolean
): Read => {
  const token = peek(tokens, start);
  if (signed && isSign(token)) {
    return Option.map(
      argument(tokens, start + 1, depth + 1, bars, false),
      ([term, next]) => [token === "-" ? negate(term) : term, next] as const
    );
  }
  if (token === "{") {
    return group(tokens, start, "}", depth + 1, 0);
  }
  if (token === "(") {
    return group(tokens, start, ")", depth + 1, 0);
  }
  if (isDigit(token)) {
    return Option.some([integer(Number(token)), start + 1]);
  }
  if (isLetter(token) || isSymbolCommand(token)) {
    return Option.some([symbolOf(token), start + 1]);
  }
  return token === "\\frac" || token === "\\sqrt" || Rec.has(FUNCTIONS, token)
    ? primary(tokens, start, depth + 1, bars)
    : Option.none();
};

/** A fraction `\frac{a}{b}`: the numerator times the reciprocal of the denominator. */
const fraction = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number
): Read =>
  Option.flatMap(
    argument(tokens, start, depth + 1, bars, false),
    ([numerator, next]) =>
      Option.map(
        argument(tokens, next, depth + 1, bars, false),
        ([denominator, end]) =>
          [["Multiply", numerator, reciprocal(denominator)], end] as const
      )
  );

/** A whole number from 1 to `INDEX_MAX`, alone or braced, as a root's index or a function's power. */
const index = (
  tokens: readonly string[],
  start: number,
  close: string
): Option.Option<readonly [number, number]> => {
  const braced = close !== END;
  const first = braced ? start + 1 : start;
  const single = isDigit(peek(tokens, first)) ? 1 : 0;
  const digits = braced ? digitsFrom(tokens, first) : single;
  const end = first + digits;
  const value = Number(textOf(tokens, first, digits));
  if (digits === 0 || value > INDEX_MAX || value < 1) {
    return Option.none();
  }
  if (!braced) {
    return Option.some([value, end]);
  }
  return peek(tokens, end) === close
    ? Option.some([value, end + 1])
    : Option.none();
};

/**
 * A root `\sqrt{x}` or `\sqrt[n]{x}`, of index two unless one is given, which must be at least two. An
 * even root is the power `x^{1/n}`, defined where the radicand is not negative, as that power is; an odd
 * root keeps its own operator, since it is real for a negative radicand too.
 */
const root = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number
): Read => {
  const given = peek(tokens, start) === "[";
  const order: Option.Option<readonly [number, number]> = given
    ? Option.filter(index(tokens, start, "]"), ([value]) => value >= 2)
    : Option.some([2, start] as const);
  return Option.flatMap(order, ([value, next]) =>
    Option.map(
      argument(tokens, next, depth + 1, bars, false),
      ([radicand, end]) =>
        [
          value % 2 === 0
            ? ["Power", radicand, Rational.makeUnsafe(1n, BigInt(value))]
            : ["Root", integer(value), radicand],
          end,
        ] as const
    )
  );
};

/** The term a function makes of its argument: `\exp` a power of `e`, `\log` and `\lg` a logarithm with its base. */
const applied = (operator: Operator, base: Term, operand: Term): Term => {
  if (operator === "Power") {
    return ["Power", "e", operand];
  }
  return operator === "Log" ? ["Log", base, operand] : [operator, operand];
};

/**
 * A function and its argument. `\log_b` takes a base, `\log` and `\lg` alone are base ten, and a whole
 * power before the argument raises the result, as `\sin^2 x` squares the sine; any other power, such as
 * the ambiguous `\sin^{-1}`, is refused. The argument is a bracketed group, or the product that follows
 * up to the next sign or function, so `\sin 2x` is the sine of `2x`.
 */
const call = (
  tokens: readonly string[],
  start: number,
  operator: Operator,
  depth: number,
  bars: number
): Read => {
  const based = peek(tokens, start) === "\\log" && peek(tokens, start + 1) === "_";
  const base: Read = based
    ? argument(tokens, start + 2, depth + 1, bars, false)
    : Option.some([integer(10), start + 1]);
  return Option.flatMap(base, ([logarithm, afterBase]) => {
    const raised = peek(tokens, afterBase) === "^";
    const power: Option.Option<readonly [number, number]> = raised
      ? index(
          tokens,
          afterBase + 1,
          peek(tokens, afterBase + 1) === "{" ? "}" : END
        )
      : Option.some([1, afterBase] as const);
    return Option.flatMap(power, ([exponent, afterPower]) =>
      Option.map(
        peek(tokens, afterPower) === "("
          ? group(tokens, afterPower, ")", depth + 1, 0)
          : product(tokens, afterPower, depth + 1, bars, true),
        ([operand, end]) => {
          const term = applied(operator, logarithm, operand);
          return [
            exponent === 1 ? term : ["Power", term, integer(exponent)],
            end,
          ] as const;
        }
      )
    );
  });
};

/** The bracket that closes each opening bracket. */
const CLOSING: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** One operand: a number, a symbol, a bracketed group, an absolute value, a fraction, a root, or a function. */
const primary = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number
): Read => {
  if (depth > DEPTH_MAX) {
    return Option.none();
  }
  const token = peek(tokens, start);
  if (isDigit(token) || token === ".") {
    return number(tokens, start);
  }
  if (isLetter(token)) {
    return symbol(tokens, start);
  }
  if (isSymbolCommand(token)) {
    return Option.some([symbolOf(token), start + 1]);
  }
  const close = Rec.get(CLOSING, token);
  if (Option.isSome(close)) {
    return group(tokens, start, close.value, depth + 1, 0);
  }
  if (token === "|") {
    return Option.map(
      group(tokens, start, "|", depth + 1, bars + 1),
      ([term, next]) => [["Abs", term], next] as const
    );
  }
  if (token === "\\frac") {
    return fraction(tokens, start + 1, depth + 1, bars);
  }
  if (token === "\\sqrt") {
    return root(tokens, start + 1, depth + 1, bars);
  }
  return Option.flatMap(Rec.get(FUNCTIONS, token), (operator) =>
    call(tokens, start, operator, depth + 1, bars)
  );
};

/** An operand with its power, `x^2` or `e^{x}`. A second power on the same operand, `x^2^3`, is refused, as LaTeX refuses it. */
const power = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number
): Read =>
  Option.flatMap(primary(tokens, start, depth + 1, bars), ([base, next]) => {
    if (peek(tokens, next) !== "^") {
      return Option.some([base, next]);
    }
    return Option.flatMap(
      argument(tokens, next + 1, depth + 1, bars, true),
      ([exponent, after]) =>
        peek(tokens, after) === "^"
          ? Option.none()
          : Option.some([["Power", base, exponent], after] as const)
    );
  });

/**
 * A product of powers, joined by `*`, `/`, or nothing, as in `3x(x-1)`. Division binds as tightly as
 * multiplication, from the left, so `1/2x` is half of `x`. Inside a function's argument written without
 * brackets the product ends at a written sign, so `\sin x/2` halves the sine.
 */
const product = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number,
  argument: boolean
): Read => {
  const first = power(tokens, start, depth + 1, bars);
  if (Option.isNone(first)) {
    return first;
  }
  let [factors, position]: readonly [readonly Term[], number] = [
    [first.value[0]],
    first.value[1],
  ];
  const continues = (token: string) =>
    token === "*" || token === "/"
      ? !argument
      : startsFactor(token, bars, argument);
  while (continues(peek(tokens, position))) {
    const token = peek(tokens, position);
    const next = power(
      tokens,
      token === "*" || token === "/" ? position + 1 : position,
      depth + 1,
      bars
    );
    if (Option.isNone(next)) {
      return next;
    }
    const [factor, after] = next.value;
    factors = Arr.append(factors, token === "/" ? reciprocal(factor) : factor);
    position = after;
  }
  return Option.some([joined("Multiply", factors), position]);
};

/** A sum of products, each with an optional sign, as in `-3x^2 + 4x`. */
const sum = (
  tokens: readonly string[],
  start: number,
  depth: number,
  bars: number
): Read => {
  let [terms, position]: readonly [readonly Term[], number] = [[], start];
  do {
    const sign = peek(tokens, position);
    const next = product(
      tokens,
      isSign(sign) ? position + 1 : position,
      depth + 1,
      bars,
      false
    );
    if (Option.isNone(next)) {
      return next;
    }
    const [term, after] = next.value;
    terms = Arr.append(terms, sign === "-" ? negate(term) : term);
    position = after;
  } while (isSign(peek(tokens, position)));
  return Option.some([joined("Add", terms), position]);
};

/**
 * Where the expression starts after a name it defines, as `y =`, `f(x) =`, or `f'(x) =` is typed
 * before an answer: the name is the question's, so only the expression is graded. Any other `=` is
 * refused where it stands, since an equation is not an expression.
 */
const definitionEnd = (tokens: readonly string[]) => {
  if (!isLetter(peek(tokens, 0))) {
    return 0;
  }
  let position = 1;
  while (peek(tokens, position) === "'") {
    position += 1;
  }
  const argued =
    peek(tokens, position) === "(" &&
    isLetter(peek(tokens, position + 1)) &&
    peek(tokens, position + 2) === ")";
  const named = argued ? position + 3 : position;
  return peek(tokens, named) === "=" ? named + 1 : 0;
};

/**
 * Reads an expression typed as LaTeX, or as it is typed on a keyboard (`3*x^2 - sqrt(x)`), into a term,
 * or none when the text is too long, nests too deep, or is no expression the grader reads: an equation,
 * an inequality, an interval or a set, a sum or an integral, or a sign it does not know.
 */
export const parseExpression = (source: string): Option.Option<Term> =>
  Option.flatMap(tokenize(source), (tokens) =>
    Option.flatMap(sum(tokens, definitionEnd(tokens), 0, 0), ([term, end]) =>
      end === tokens.length ? Option.some(term) : Option.none()
    )
  );
