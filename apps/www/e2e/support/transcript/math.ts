import type { MathRequestSchema } from "@repo/math/schema/request";
import type { MathResultSchema } from "@repo/math/schema/result";
import { Array as Arr, Option } from "effect";
import {
  type Card,
  reply,
  stored,
  working,
} from "./message";

/** A request and a result of the CAS, as the wire holds them. */
type MathRequest = typeof MathRequestSchema.Encoded;
type MathResult = typeof MathResultSchema.Encoded;

/**
 * Every result below is what the CAS returned for the request in its `input`,
 * run with the service's own worker (SymPy 1.14.0) on 12 October 2026. Only
 * the steps of the Euclidean algorithm are written by `divisions`, from the
 * same rule the CAS follows.
 */

const EQUALS = { expression: "equals", latex: "=" };

const ROOTS_EXPRESSION =
  "x**20 - 210*x**19 + 20615*x**18 - 1256850*x**17 + 53327946*x**16 - 1672280820*x**15 + 40171771630*x**14 - 756111184500*x**13 + 11310276995381*x**12 - 135585182899530*x**11 + 1307535010540395*x**10 - 10142299865511450*x**9 + 63030812099294896*x**8 - 311333643161390640*x**7 + 1206647803780373360*x**6 - 3599979517947607200*x**5 + 8037811822645051776*x**4 - 12870931245150988800*x**3 + 13803759753640704000*x**2 - 8752948036761600000*x + 2432902008176640000";
const ROOTS_LATEX =
  "x^{20} - 210 x^{19} + 20615 x^{18} - 1256850 x^{17} + 53327946 x^{16} - 1672280820 x^{15} + 40171771630 x^{14} - 756111184500 x^{13} + 11310276995381 x^{12} - 135585182899530 x^{11} + 1307535010540395 x^{10} - 10142299865511450 x^{9} + 63030812099294896 x^{8} - 311333643161390640 x^{7} + 1206647803780373360 x^{6} - 3599979517947607200 x^{5} + 8037811822645051776 x^{4} - 12870931245150988800 x^{3} + 13803759753640704000 x^{2} - 8752948036761600000 x + 2432902008176640000";
const EXPAND_EXPRESSION =
  "32*x**5 + 240*x**4*y - 80*x**4*z + 720*x**3*y**2 - 480*x**3*y*z + 80*x**3*z**2 + 1080*x**2*y**3 - 1080*x**2*y**2*z + 360*x**2*y*z**2 - 40*x**2*z**3 + 810*x*y**4 - 1080*x*y**3*z + 540*x*y**2*z**2 - 120*x*y*z**3 + 10*x*z**4 + 243*y**5 - 405*y**4*z + 270*y**3*z**2 - 90*y**2*z**3 + 15*y*z**4 - z**5";
const EXPAND_LATEX =
  "32 x^{5} + 240 x^{4} y - 80 x^{4} z + 720 x^{3} y^{2} - 480 x^{3} y z + 80 x^{3} z^{2} + 1080 x^{2} y^{3} - 1080 x^{2} y^{2} z + 360 x^{2} y z^{2} - 40 x^{2} z^{3} + 810 x y^{4} - 1080 x y^{3} z + 540 x y^{2} z^{2} - 120 x y z^{3} + 10 x z^{4} + 243 y^{5} - 405 y^{4} z + 270 y^{3} z^{2} - 90 y^{2} z^{3} + 15 y z^{4} - z^{5}";

/** The 65 digits of 50!, which `factorial(50)` evaluates to. */
const FACTORIAL =
  "30414093201713378043612608166064768844377641568960512000000000000";

/** A result with the fields the CAS leaves empty written out. */
function result(
  fields: Pick<MathResult, "input" | "primary" | "reason" | "status"> &
    Partial<
      Pick<
        MathResult,
        "conditions" | "items" | "secondary" | "stepStatus" | "steps"
      >
    >
): MathResult {
  return {
    conditions: [],
    items: [],
    kind: fields.input.operation,
    operation: fields.input.operation,
    steps: [],
    stepStatus: "unavailable",
    ...fields,
  };
}

/** The card of a finished check. */
function done(id: string, checked: MathResult): Card {
  return {
    data: {
      input: checked.input,
      kind: checked.kind,
      result: checked,
      status: checked.status,
      summary: checked.status,
    },
    id,
    type: "data-math",
  };
}

/** The card of a check that could not finish. */
function failed(id: string, input: MathRequest): Card {
  return {
    data: {
      error: "math_check_unavailable",
      input,
      kind: input.operation,
      status: "error",
    },
    id,
    type: "data-math",
  };
}

/** The reply of one math run that ended with these cards. */
function replyOf(
  id: string,
  cards: readonly Card[],
  outcome?: Parameters<typeof stored>[1]
) {
  return reply({
    capability: "math",
    cards,
    id,
    ...(outcome === undefined ? {} : { outcome }),
    text: "Hier ist die geprüfte Rechnung.",
  });
}

const FACTORIAL_INPUT = {
  expression: "factorial(50)",
  kind: "math",
  operation: "evaluate",
} satisfies MathRequest;

/** A number of 65 digits, which is both what is given and what it evaluates to. */
export const factorial = replyOf("math-factorial", [
  done(
    "math-factorial-1",
    result({
      input: FACTORIAL_INPUT,
      primary: { expression: FACTORIAL, latex: FACTORIAL },
      reason: "Exact arithmetic was checked.",
      secondary: { expression: FACTORIAL, latex: FACTORIAL },
      status: "verified",
    })
  ),
]);

const EXPAND_INPUT = {
  expression: "(2*x+3*y-z)**5",
  kind: "math",
  operation: "expand",
} satisfies MathRequest;

/** An expansion of 21 terms, with the one step that gives it. */
export const expansion = replyOf("math-expand", [
  done(
    "math-expand-1",
    result({
      input: EXPAND_INPUT,
      primary: {
        expression: "(2*x + 3*y - z)**5",
        latex: "\\left(2 x + 3 y - z\\right)^{5}",
      },
      reason: "The expand transformation was checked.",
      secondary: { expression: EXPAND_EXPRESSION, latex: EXPAND_LATEX },
      status: "verified",
      stepStatus: "complete",
      steps: [
        {
          action: "expand",
          items: [],
          primary: {
            expression: "(2*x + 3*y - z)**5",
            latex: "\\left(2 x + 3 y - z\\right)^{5}",
          },
          relation: { expression: "becomes", latex: "\\Rightarrow" },
          secondary: { expression: EXPAND_EXPRESSION, latex: EXPAND_LATEX },
        },
      ],
    })
  ),
]);

/** The division steps of the Euclidean algorithm, written the way the CAS writes them. */
function divisions(first: number, second: number) {
  return Arr.unfold(
    { larger: first, smaller: second },
    ({ larger, smaller }) =>
      smaller === 0
        ? Option.none()
        : Option.some([
            {
              action: "gcd",
              items: [],
              primary: {
                expression: `${larger} = ${Math.floor(larger / smaller)}*${smaller} + ${larger % smaller}`,
                latex: `${larger} = ${Math.floor(larger / smaller)} \\cdot ${smaller} + ${larger % smaller}`,
              },
            },
            { larger: smaller, smaller: larger % smaller },
          ])
  );
}

const EUCLID_INPUT = {
  kind: "math",
  operation: "gcd",
  values: ["165580141", "102334155"],
} satisfies MathRequest;

/**
 * The greatest common divisor of two neighbours in the Fibonacci numbers, the
 * pair that takes Euclid's algorithm the most divisions for numbers of their
 * size: 39 divisions and the row that gives the divisor, 40 rows.
 */
export const euclid = replyOf("math-euclid", [
  done(
    "math-euclid-1",
    result({
      input: EUCLID_INPUT,
      primary: {
        expression: "gcd(165580141, 102334155)",
        latex: "\\gcd\\left(165580141, 102334155\\right)",
      },
      reason: "The discrete math operation was checked exactly.",
      secondary: { expression: "1", latex: "1" },
      status: "verified",
      stepStatus: "complete",
      steps: [
        ...divisions(165_580_141, 102_334_155),
        {
          action: "gcd",
          items: [],
          primary: {
            expression: "gcd(165580141, 102334155)",
            latex: "\\gcd\\left(165580141, 102334155\\right)",
          },
          relation: EQUALS,
          secondary: { expression: "1", latex: "1" },
        },
      ],
    })
  ),
]);

const IDENTITY_INPUT = {
  kind: "math",
  matrix: [
    ["2", "0", "0"],
    ["0", "2", "0"],
    ["0", "0", "2"],
  ],
  operation: "eigen_analysis",
} satisfies MathRequest;

/** An eigen analysis whose eigenspace has a basis of three vectors. */
export const eigen = replyOf("math-eigen", [
  done(
    "math-eigen-1",
    result({
      input: IDENTITY_INPUT,
      items: [
        { label: "eigenvalue", latex: "2", value: "2" },
        {
          label: "algebraic_multiplicity",
          latex: "\\lambda = 2:\\;3",
          value: "lambda = 2: 3",
        },
        {
          label: "geometric_multiplicity",
          latex: "\\lambda = 2:\\;3",
          value: "lambda = 2: 3",
        },
        {
          label: "eigenbasis",
          latex:
            "\\lambda = 2:\\;\\operatorname{span}\\left\\{\\left[\\begin{matrix}1\\\\0\\\\0\\end{matrix}\\right], \\left[\\begin{matrix}0\\\\1\\\\0\\end{matrix}\\right], \\left[\\begin{matrix}0\\\\0\\\\1\\end{matrix}\\right]\\right\\}",
          value:
            "lambda = 2: span(Matrix([[1], [0], [0]]), Matrix([[0], [1], [0]]), Matrix([[0], [0], [1]]))",
        },
        {
          label: "diagonalizable",
          latex: "\\operatorname{true}",
          value: "true",
        },
      ],
      primary: {
        expression: "Matrix([[2, 0, 0], [0, 2, 0], [0, 0, 2]])",
        latex:
          "\\left[\\begin{matrix}2 & 0 & 0\\\\0 & 2 & 0\\\\0 & 0 & 2\\end{matrix}\\right]",
      },
      reason:
        "Eigenvalues, algebraic multiplicities, eigenspace bases, geometric multiplicities, and diagonalizability were checked exactly.",
      status: "verified",
    })
  ),
]);

const ROOTS_INPUT = {
  expression: Arr.join(
    Arr.makeBy(20, (index) => `(x-${index + 1})`),
    "*"
  ),
  kind: "math",
  operation: "roots",
  variable: "x",
} satisfies MathRequest;

/** The roots of a polynomial of degree 20: 20 rows, and a polynomial of 474 characters to start from. */
export const roots = replyOf("math-roots", [
  done(
    "math-roots-1",
    result({
      input: ROOTS_INPUT,
      items: Arr.makeBy(20, (index) => ({
        label: "root",
        latex: `\\mathtt{\\text{${20 - index}: 1}}`,
        value: `${20 - index}: 1`,
      })),
      primary: { expression: ROOTS_EXPRESSION, latex: ROOTS_LATEX },
      reason: "Polynomial roots and multiplicities were checked exactly.",
      status: "verified",
    })
  ),
]);

const RREF_INPUT = {
  kind: "math",
  matrix: [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "10"],
  ],
  operation: "rref",
} satisfies MathRequest;

/** A matrix brought to reduced row echelon form: the operation with the longest German label. */
export const rref = replyOf("math-rref", [
  done(
    "math-rref-1",
    result({
      input: RREF_INPUT,
      primary: {
        expression: "Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 10]])",
        latex:
          "\\left[\\begin{matrix}1 & 2 & 3\\\\4 & 5 & 6\\\\7 & 8 & 10\\end{matrix}\\right]",
      },
      reason: "The matrix operation was checked exactly.",
      secondary: {
        expression: "Matrix([[1, 0, 0], [0, 1, 0], [0, 0, 1]])",
        latex:
          "\\left[\\begin{matrix}1 & 0 & 0\\\\0 & 1 & 0\\\\0 & 0 & 1\\end{matrix}\\right]",
      },
      status: "verified",
    })
  ),
]);

const DOMAIN_INPUT = {
  expression: "sqrt(x-1)/(x**2-9)",
  kind: "math",
  operation: "domain",
  variable: "x",
} satisfies MathRequest;

/** A domain with one item and one condition. */
export const domain = replyOf("math-domain", [
  done(
    "math-domain-1",
    result({
      conditions: [
        {
          expression: "(x >= 1) & (x < oo) & Ne(x, 3)",
          latex: "x \\geq 1 \\wedge x < \\infty \\wedge x \\neq 3",
        },
      ],
      input: DOMAIN_INPUT,
      items: [
        {
          label: "domain",
          latex: "\\left[1, 3\\right) \\cup \\left(3, \\infty\\right)",
          value: "Union(Interval.Ropen(1, 3), Interval.open(3, oo))",
        },
      ],
      primary: {
        expression: "sqrt(x - 1)/(x**2 - 9)",
        latex: "\\frac{\\sqrt{x - 1}}{x^{2} - 9}",
      },
      reason: "The real-valued domain was derived from the expression.",
      secondary: {
        expression: "Union(Interval.Ropen(1, 3), Interval.open(3, oo))",
        latex: "\\left[1, 3\\right) \\cup \\left(3, \\infty\\right)",
      },
      status: "verified",
    })
  ),
]);

/** The eight points the domain below leaves out, and the nine open intervals between them. */
const EXCLUDED = Arr.makeBy(8, (index) => index + 1);
const INTERVALS = Arr.makeBy(9, (index) => ({
  latex: `\\left(${index === 0 ? "-\\infty" : index}, ${index === 8 ? "\\infty" : index + 1}\\right)`,
  text: `Interval.open(${index === 0 ? "-oo" : index}, ${index === 8 ? "oo" : index + 1})`,
}));
const UNION = {
  expression: `Union(${Arr.join(
    Arr.map(INTERVALS, ({ text }) => text),
    ", "
  )})`,
  latex: Arr.join(
    Arr.map(INTERVALS, ({ latex }) => latex),
    " \\cup "
  ),
};

const CONDITIONS_INPUT = {
  expression: `1/(${Arr.join(
    Arr.map(EXCLUDED, (point) => `(x-${point})`),
    "*"
  )})`,
  kind: "math",
  operation: "domain",
  variable: "x",
} satisfies MathRequest;

/** A domain with eight conditions, one for each point it leaves out: three more than the five a row shows. */
export const conditions = replyOf("math-conditions", [
  done(
    "math-conditions-1",
    result({
      conditions: Arr.map(EXCLUDED, (point) => ({
        expression: `Ne(x, ${point})`,
        latex: `x \\neq ${point}`,
      })),
      input: CONDITIONS_INPUT,
      items: [{ label: "domain", latex: UNION.latex, value: UNION.expression }],
      primary: {
        expression: `1/(${Arr.join(
          Arr.map(Arr.reverse(EXCLUDED), (point) => `(x - ${point})`),
          "*"
        )})`,
        latex: `\\frac{1}{${Arr.join(
          Arr.map(
            Arr.reverse(EXCLUDED),
            (point) => `\\left(x - ${point}\\right)`
          ),
          " "
        )}}`,
      },
      reason: "The real-valued domain was derived from the expression.",
      secondary: UNION,
      status: "verified",
    })
  ),
]);

const CHECK_INPUT = {
  expression: "(x^2-9)/(x-3)",
  kind: "math",
  operation: "simplify",
} satisfies MathRequest;

/** The card of a check that could not finish. */
export const checkFailed = failed("math-failed-1", CHECK_INPUT);

/** A check that could not finish. */
export const failedCheck = replyOf("math-failed", [checkFailed], "failed");

/** The card of a check that is still working. */
const checkLoading: Card = {
  data: { input: CHECK_INPUT, kind: "simplify", status: "loading" },
  id: "math-loading-1",
  type: "data-math",
};

/** A check that is still working: its card loads, and its turn runs. */
export const loadingCheck = [
  working("math", "math-loading", stored([checkLoading])),
];
