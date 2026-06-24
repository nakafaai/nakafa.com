import type { MathComputation } from "@repo/math/schema/work";

const SOLUTION_LIST_PATTERN = /^\[\s*(.*)\s*\]$/u;
const LATEX_SOLUTION_LIST_PATTERN = /^\\left\[\s*(.*)\s*\\right\]$/u;

/** Selects the formula expression shown to students for one computation. */
export function formulaExpressionForComputation(
  computation: MathComputation
): MathComputation["primary"] {
  const solveExpression = solveExpressionForComputation(computation);
  if (solveExpression) {
    return solveExpression;
  }

  return computation.secondary ?? computation.primary;
}

/** Builds a clearer equation-solving display from CAS solution-set evidence. */
function solveExpressionForComputation(
  computation: MathComputation
): MathComputation["primary"] | undefined {
  if (computation.operation !== "solve") {
    return;
  }

  const variables = computation.input.variables ?? [];
  const variable = variables[0];
  if (variables.length !== 1 || !variable || !computation.secondary) {
    return;
  }

  const solutionBody = listBody(computation.secondary.expression);
  if (!solutionBody) {
    return;
  }

  const solutions = splitSolutions(solutionBody);
  if (solutions.length === 0) {
    return;
  }

  const latexBody = latexListBody(computation.secondary.latex);
  const latexSolutions = latexBody ? splitSolutions(latexBody) : [];

  return {
    expression: solveExpressionText({ solutions, variable }),
    latex: solveExpressionLatex({ latexSolutions, solutions, variable }),
  };
}

/** Returns the inner text of a bracketed solution list expression. */
function listBody(expression: string) {
  return SOLUTION_LIST_PATTERN.exec(expression)?.[1]?.trim();
}

/** Returns the inner text of a bracketed LaTeX solution list. */
function latexListBody(latex: string) {
  return LATEX_SOLUTION_LIST_PATTERN.exec(latex)?.[1]?.trim();
}

/** Splits a flat CAS solution list into displayable values. */
function splitSolutions(body: string) {
  return body.split(",").map(trimSolution).filter(hasSolutionValue);
}

/** Trims one solution value from a CAS list. */
function trimSolution(solution: string) {
  return solution.trim();
}

/** Keeps non-empty solution values after splitting a CAS list. */
function hasSolutionValue(solution: string) {
  return solution.length > 0;
}

/** Formats a solve result for plain-text evidence snapshots. */
function solveExpressionText({
  solutions,
  variable,
}: {
  readonly solutions: readonly string[];
  readonly variable: string;
}) {
  if (solutions.length === 1) {
    return `${variable} = ${solutions[0]}`;
  }

  return `${variable} in {${solutions.join(", ")}}`;
}

/** Formats a solve result for KaTeX rendering. */
function solveExpressionLatex({
  latexSolutions,
  solutions,
  variable,
}: {
  readonly latexSolutions: readonly string[];
  readonly solutions: readonly string[];
  readonly variable: string;
}) {
  const displayedSolutions =
    latexSolutions.length === solutions.length ? latexSolutions : solutions;

  if (displayedSolutions.length === 1) {
    return `${variable} = ${displayedSolutions[0]}`;
  }

  return `${variable} \\in \\left\\{${displayedSolutions.join(", ")}\\right\\}`;
}
