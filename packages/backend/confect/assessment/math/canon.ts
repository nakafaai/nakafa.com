import type { Term } from "@repo/backend/confect/assessment/math/term";
import {
  isNumber,
  isSymbol,
  isVariable,
} from "@repo/backend/confect/assessment/math/term";
import {
  Array as Arr,
  Match,
  Number as Num,
  Option,
  Order,
  pipe,
  Rational,
  String as Str,
} from "effect";

/** One atom of a monomial with its whole exponent: the variable `x` squared, or the atom `Sin(1*x)` once. */
type Factor = readonly [atom: string, exponent: number];

/** One part of a polynomial: the text of its monomial, the monomial's factors by atom, and its exact coefficient. */
type Part = readonly [
  text: string,
  factors: readonly Factor[],
  coefficient: Rational.Rational,
];

/**
 * A canonical form: a polynomial in atoms with exact coefficients, its parts ordered by their monomial's
 * text, with no part twice and no zero coefficient, so two forms are the same exactly when their texts
 * are. An atom is a variable, a constant, or what the polynomial cannot open, such as a sine, a
 * logarithm, a power with a fractional or symbolic exponent, or the reciprocal of a sum; its text is
 * built from the canonical forms of its operands, so `\sin(2x)` and `\sin(x+x)` are one atom. Exponents
 * may be negative, so `\frac{1}{x}` is `x^-1` and `\frac{x^2}{x}` is `x`.
 */
export type Polynomial = readonly Part[];

/** A canonical form and the products the budget still allows, or none when the form cannot be built. */
type Canon = Option.Option<readonly [Polynomial, number]>;

/**
 * The products of parts one expression may spend while it is expanded. Expanding `(x+1)^{12}` spends
 * under a hundred, so the budget leaves room for any real answer and stops a typed `(a+b+c+d)^{12}`.
 */
export const PRODUCTS_MAX = 4096;

/** The most parts one canonical form holds. */
const PARTS_MAX = 64;

/** The highest power of a sum that is multiplied out; a higher one stays an atom. */
const EXPANSION_MAX = 12;

/** The largest exponent an atom carries exactly; a larger power stays one atom of its own. */
const EXPONENT_MAX = 10_000;

/** The most bits of an exact coefficient raised to a power; a larger one stays an atom. */
const BITS_MAX = 1024;

const ONE = Rational.fromBigInt(1n);

/** The canonical form of zero, which has no part. */
const ZERO: Polynomial = [];

const byAtom = Order.mapInput(Order.String, ([atom]: Factor) => atom);

const byText = Order.mapInput(Order.String, ([text]: Part) => text);

/** The text of a monomial: its factors, each with its exponent when that is not one. */
const monomialText = (factors: readonly Factor[]) =>
  Arr.join(
    Arr.map(factors, ([atom, exponent]) =>
      exponent === 1 ? atom : `${atom}^${exponent}`
    ),
    "*"
  );

/** The text of a canonical form, which names it: `0` for zero, else each coefficient with its monomial. */
export const textOf = (polynomial: Polynomial) =>
  Arr.isReadonlyArrayEmpty(polynomial)
    ? "0"
    : Arr.join(
        Arr.map(
          polynomial,
          ([text, , coefficient]) => `${Rational.format(coefficient)}*${text}`
        ),
        "+"
      );

/** A monomial's factors multiplied: the exponents of one atom added, and an atom whose exponents cancel gone. */
const timesFactors = (
  left: readonly Factor[],
  right: readonly Factor[]
): readonly Factor[] =>
  pipe(
    Arr.appendAll(left, right),
    Arr.sort(byAtom),
    Arr.match({
      onEmpty: () => [],
      onNonEmpty: (sorted) =>
        pipe(
          Arr.groupWith(sorted, ([one], [other]) => one === other),
          Arr.map(
            (group): Factor => [
              group[0][0],
              Num.sumAll(Arr.map(group, ([, exponent]) => exponent)),
            ]
          ),
          Arr.filter(([, exponent]) => exponent !== 0)
        ),
    })
  );

/** Parts gathered into a canonical form: the parts of one monomial added, and a part that adds to zero gone. */
const normalize = (parts: readonly Part[]): Polynomial =>
  pipe(
    parts,
    Arr.sort(byText),
    Arr.match({
      onEmpty: () => [],
      onNonEmpty: (sorted) =>
        pipe(
          Arr.groupWith(sorted, ([one], [other]) => one === other),
          Arr.map(
            (group): Part => [
              group[0][0],
              group[0][1],
              Rational.sumAll(Arr.map(group, ([, , coefficient]) => coefficient)),
            ]
          ),
          Arr.filter(([, , coefficient]) => !Rational.isZero(coefficient))
        ),
    })
  );

/** The canonical form of an exact number. */
const constant = (value: Rational.Rational): Polynomial =>
  Rational.isZero(value) ? [] : [["", [], value]];

/** The canonical form of one atom to a whole power. */
const atomic = (atom: string, exponent = 1): Polynomial => {
  const factors: readonly Factor[] = [[atom, exponent]];
  return [[monomialText(factors), factors, ONE]];
};

/** The exact number a canonical form is, or none when it holds an atom. */
const numberOf = (polynomial: Polynomial): Option.Option<Rational.Rational> =>
  Arr.match(polynomial, {
    onEmpty: () => Option.some(Rational.fromBigInt(0n)),
    onNonEmpty: ([[text, , coefficient], ...rest]) =>
      text === "" && Arr.isReadonlyArrayEmpty(rest)
        ? Option.some(coefficient)
        : Option.none(),
  });

/** Two canonical forms added. */
const add = (left: Polynomial, right: Polynomial): Polynomial =>
  normalize(Arr.appendAll(left, right));

/** The difference of two canonical forms, which is empty exactly when they are the same. */
export const subtract = (left: Polynomial, right: Polynomial): Polynomial =>
  add(
    left,
    Arr.map(
      right,
      ([text, factors, coefficient]): Part => [
        text,
        factors,
        Rational.negate(coefficient),
      ]
    )
  );

/** Two canonical forms multiplied out, when the budget allows every product of their parts. */
const multiply = (
  left: Polynomial,
  right: Polynomial,
  budget: number
): Canon => {
  const cost = left.length * right.length;
  if (cost > budget) {
    return Option.none();
  }
  const product = normalize(
    Arr.flatMap(left, ([, leftFactors, leftCoefficient]) =>
      Arr.map(right, ([, rightFactors, rightCoefficient]): Part => {
        const factors = timesFactors(leftFactors, rightFactors);
        return [
          monomialText(factors),
          factors,
          Rational.multiply(leftCoefficient, rightCoefficient),
        ];
      })
    )
  );
  return product.length > PARTS_MAX
    ? Option.none()
    : Option.some([product, budget - cost]);
};

/** Canonical forms multiplied out from one, each product spending from the budget the one before it left. */
const productOf = (
  factors: readonly Polynomial[],
  budget: number
): Canon => {
  const one: Canon = Option.some([constant(ONE), budget]);
  return Arr.reduce(factors, one, (sofar, factor) =>
    Option.flatMap(sofar, ([product, left]) => multiply(product, factor, left))
  );
};

/** The bits of an exact number's larger part, which its powers multiply. */
const bitsOf = (value: Rational.Rational) =>
  Math.max(
    value.numerator.toString(2).length,
    value.denominator.toString(2).length
  );

/** A power kept as one atom, named by its base and exponent, for a power the polynomial does not open. */
const opaque = (base: Polynomial, exponent: string): Polynomial =>
  atomic(`(${textOf(base)})^(${exponent})`);

/**
 * One part to a whole power: its coefficient raised exactly and each exponent multiplied. Zero to a
 * negative power is none. A coefficient that would grow past `BITS_MAX` bits, or an exponent past
 * `EXPONENT_MAX`, stays an atom.
 */
const partPower = (part: Part, exponent: number): Option.Option<Polynomial> => {
  const [, factors, coefficient] = part;
  const raised = Arr.map(
    factors,
    ([atom, power]): Factor => [atom, power * exponent]
  );
  if (
    bitsOf(coefficient) * Math.abs(exponent) > BITS_MAX ||
    Arr.some(raised, ([, power]) => Math.abs(power) > EXPONENT_MAX)
  ) {
    return Option.some(opaque([part], `${exponent}`));
  }
  return Option.map(Rational.pow(coefficient, exponent), (value) => [
    [monomialText(raised), raised, value],
  ]);
};

/**
 * A canonical form to a whole power. Zero to a positive power is zero and to a negative one is none,
 * one part is raised exactly (`partPower`), a sum is multiplied out up to `EXPANSION_MAX`, and any other
 * power of a sum, a reciprocal included, stays one atom with that exponent.
 */
const wholePower = (base: Polynomial, exponent: number, budget: number): Canon => {
  if (exponent === 0) {
    return Option.some([constant(ONE), budget]);
  }
  if (Arr.isReadonlyArrayEmpty(base)) {
    return exponent > 0 ? Option.some([[], budget]) : Option.none();
  }
  if (base.length === 1) {
    return Option.map(
      partPower(base[0], exponent),
      (polynomial) => [polynomial, budget] as const
    );
  }
  if (exponent < 0 || exponent > EXPANSION_MAX) {
    return Option.some([atomic(`(${textOf(base)})`, exponent), budget]);
  }
  return productOf(Arr.replicate(base, exponent), budget);
};

/**
 * A power by the canonical form of its exponent. A whole exponent up to `EXPONENT_MAX` is applied
 * (`wholePower`); a fraction `p/q` is the atom of the `q`-th root to the power `p`, so `\sqrt{x}`,
 * `x^{1/2}`, and `x^{-1/2}` share one atom; anything else, as `e^{x}`, is an atom of its own.
 */
const raise = (base: Polynomial, exponent: Polynomial, budget: number): Canon =>
  Option.match(numberOf(exponent), {
    onNone: () => Option.some([opaque(base, textOf(exponent)), budget]),
    onSome: (value) => {
      const numerator = Number(value.numerator);
      if (Math.abs(numerator) > EXPONENT_MAX) {
        return Option.some([opaque(base, Rational.format(value)), budget]);
      }
      return Rational.isInteger(value)
        ? wholePower(base, numerator, budget)
        : Option.some([
            atomic(`(${textOf(base)})^(1/${value.denominator})`, numerator),
            budget,
          ]);
    },
  });

/** The canonical forms of several operands, each spending from the budget the one before it left. */
const forms = (
  operands: readonly Term[],
  budget: number
): Option.Option<readonly [readonly Polynomial[], number]> => {
  const none: Option.Option<readonly [readonly Polynomial[], number]> =
    Option.some([[], budget]);
  return Arr.reduce(operands, none, (sofar, operand) =>
    Option.flatMap(sofar, ([done, left]) =>
      Option.map(
        canon(operand, left),
        ([form, rest]) => [Arr.append(done, form), rest] as const
      )
    )
  );
};

/** The canonical form of a term, spending at most the budget's products. */
const canon = (term: Term, budget: number): Canon => {
  if (isNumber(term)) {
    return Option.some([constant(term), budget]);
  }
  if (isSymbol(term)) {
    return Option.some([atomic(term), budget]);
  }
  const [operator, ...operands] = term;
  return Option.flatMap(forms(operands, budget), ([operandForms, left]) =>
    Match.value(operator).pipe(
      Match.when("Add", () =>
        Option.some([Arr.reduce(operandForms, ZERO, add), left] as const)
      ),
      Match.when("Multiply", () => productOf(operandForms, left)),
      Match.when("Power", () =>
        raise(operandForms[0], operandForms[1], left)
      ),
      Match.orElse(() =>
        Option.some([
          atomic(`${operator}(${Arr.join(Arr.map(operandForms, textOf), ",")})`),
          left,
        ] as const)
      )
    )
  );
};

/**
 * The canonical form of a term, or none when building it would spend more than `PRODUCTS_MAX` products
 * of parts, grow past `PARTS_MAX` parts, or divide by zero. Two terms whose forms are the same are equal
 * wherever both are defined: a proof, not a sample.
 */
export const canonicalOf = (term: Term): Option.Option<Polynomial> =>
  Option.map(canon(term, PRODUCTS_MAX), ([polynomial]) => polynomial);

/**
 * Whether every monomial of a canonical form is a product of variables alone. Such a form is a
 * polynomial in its variables, which is zero everywhere only when it has no part, so a difference of
 * this kind decides that two expressions differ. A constant such as `e` or `pi`, or any other atom,
 * leaves the question to a number.
 */
export const isVariablePolynomial = (polynomial: Polynomial) =>
  Arr.every(polynomial, ([, factors]) =>
    Arr.every(
      factors,
      ([atom]) => isVariable(atom) && !Str.includes("(")(atom)
    )
  );
