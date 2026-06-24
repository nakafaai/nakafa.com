import { MathPlanningError } from "@repo/math/reason/errors";
import type { MathRequest } from "@repo/math/schema/request";
import { getExpressionSymbols } from "@repo/math/schema/shared";
import { Effect } from "effect";

const RELATION_OPERATOR_PATTERN = />=|<=|[=<>]/u;
const CONNECTOR_PATTERN = /\s+\b(?:and|dan|serta|with|dengan)\b\s+/iu;
const EQUALITY_OPERATOR_PATTERN = /(?<![<>])=(?![=])/u;
const LEADING_SOLVE_COMMAND_PATTERN =
  /^\s*(?:.*?\b(?:solve|selesaikan|tentukan|cari|mencari)\b\s*)/iu;
const LEADING_RELATION_DESCRIPTOR_PATTERN =
  /^\s*(?:(?:the\s+)?(?:(?:linear|quadratic)\s+)?equation|persamaan(?:\s+(?:linear|kuadrat|satu|variabel))*)\b\s*/iu;
const BOUND_PATTERN =
  /^\s*(?<left>[A-Za-z_][A-Za-z0-9_]*|[^<>=]+)\s*(?<operator>>=|<=|>|<)\s*(?<right>[A-Za-z_][A-Za-z0-9_]*|[^<>=]+)\s*$/u;
const CHAINED_BOUND_PATTERN =
  /^\s*(?<left>[^<>=]+?)\s*(?<leftOperator>>=|<=|>|<)\s*(?<variable>[A-Za-z_][A-Za-z0-9_]*)\s*(?<rightOperator>>=|<=|>|<)\s*(?<right>[^<>=]+?)\s*$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const ATOM_PATTERN_SOURCE = String.raw`(?:[-+]?\d+(?:\.\d+)?(?:[A-Za-z_][A-Za-z0-9_]*)?(?:\^\d+(?:\.\d+)?)?|[-+]?[A-Za-z_][A-Za-z0-9_]*(?:\([^()]*\))?(?:\^\d+(?:\.\d+)?)?|[-+]?\([^()]+\)(?:\^\d+(?:\.\d+)?)?)`;
const TERM_PATTERN_SOURCE = String.raw`${ATOM_PATTERN_SOURCE}(?:\s*${ATOM_PATTERN_SOURCE})*`;
const RELATION_LEFT_PATTERN = new RegExp(
  String.raw`(${TERM_PATTERN_SOURCE}(?:\s*[+\-*/^]\s*${TERM_PATTERN_SOURCE})*)\s*$`,
  "u"
);
const RELATION_RIGHT_PATTERN = new RegExp(
  String.raw`^\s*(${TERM_PATTERN_SOURCE}(?:\s*[+\-*/^]\s*${TERM_PATTERN_SOURCE})*)`,
  "u"
);

interface SolveParts {
  readonly bounds: Partial<
    Pick<
      MathRequest,
      "lower" | "lowerInclusive" | "upper" | "upperInclusive" | "variable"
    >
  >;
  readonly relations: readonly string[];
}

interface ParsedBound {
  readonly bound: string;
  readonly inclusive: boolean;
  readonly side: "lower" | "upper";
  readonly variable: string;
}

/** Builds a structured solve request without dropping constraints or systems. */
export const buildSolveRequest = Effect.fn("MathReasoning.planSolveRequest")(
  function* ({
    expression,
    text,
  }: {
    readonly expression: string;
    readonly text: string;
  }) {
    const relations = extractRelations([expression, text]);
    const solveParts = yield* splitDomainBounds(relations);
    const problem =
      solveParts.relations.length > 0 ? solveParts.relations : [expression];
    const variables = inferSolveVariables(problem, solveParts.bounds);
    const base = {
      kind: "math",
      operation: "solve",
      variables,
      ...solveParts.bounds,
    } as const;

    if (problem.length > 1) {
      return {
        ...base,
        expressions: [...problem],
      };
    }

    return {
      ...base,
      expression: problem[0],
    };
  }
);

/** Extracts relation-shaped clauses from request text and requirements. */
function extractRelations(values: readonly string[]) {
  const relations: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      for (const clause of line.split(CONNECTOR_PATTERN)) {
        const fragments = extractRelationFragments(clause);
        for (const relation of fragments) {
          if (seen.has(relation)) {
            continue;
          }

          relations.push(relation);
          seen.add(relation);
        }
      }
    }
  }

  return relations;
}

/** Splits simple same-variable solve bounds from core equations. */
function splitDomainBounds(relations: readonly string[]) {
  const equalityCount = relations.filter(isEqualityRelation).length;
  const keptRelations: string[] = [];
  const parsedBounds: ParsedBound[] = [];

  for (const relation of relations) {
    const bound = equalityCount > 0 ? parseSimpleBound(relation) : undefined;
    if (bound) {
      parsedBounds.push(bound);
      continue;
    }

    keptRelations.push(relation);
  }

  return mergeBounds({ bounds: parsedBounds, relations: keptRelations });
}

/** Merges parsed lower and upper bounds into one CAS domain request. */
function mergeBounds({
  bounds,
  relations,
}: {
  readonly bounds: readonly ParsedBound[];
  readonly relations: readonly string[];
}) {
  if (bounds.length === 0) {
    return Effect.succeed({ bounds: {}, relations } satisfies SolveParts);
  }

  const variable = bounds[0]?.variable;
  const relationSymbols = new Set(
    relations.flatMap((relation) => [...getExpressionSymbols(relation)])
  );
  if (!(variable && relationSymbols.has(variable))) {
    return Effect.fail(
      new MathPlanningError({
        message: "Solve-domain constraints must use a solved variable.",
      })
    );
  }

  const merged: SolveParts["bounds"] = { variable };
  for (const bound of bounds) {
    if (bound.variable !== variable) {
      return Effect.fail(
        new MathPlanningError({
          message: "Solve-domain constraints must use one variable.",
        })
      );
    }

    if (bound.side === "lower") {
      merged.lower = bound.bound;
      merged.lowerInclusive = bound.inclusive;
      continue;
    }

    merged.upper = bound.bound;
    merged.upperInclusive = bound.inclusive;
  }

  return Effect.succeed({ bounds: merged, relations } satisfies SolveParts);
}

/** Returns whether a relation is equality rather than an inequality bound. */
function isEqualityRelation(relation: string) {
  return EQUALITY_OPERATOR_PATTERN.test(relation);
}

/** Parses one simple variable bound such as x > 0 or 10 >= y. */
function parseSimpleBound(relation: string): ParsedBound | undefined {
  const match = BOUND_PATTERN.exec(relation);
  const groups = match?.groups;
  if (!groups) {
    return;
  }

  const left = groups.left?.trim();
  const operator = groups.operator;
  const right = groups.right?.trim();

  if (left && operator && right && IDENTIFIER_PATTERN.test(left)) {
    return boundFromLeftVariable({ bound: right, operator, variable: left });
  }

  if (left && operator && right && IDENTIFIER_PATTERN.test(right)) {
    return boundFromRightVariable({ bound: left, operator, variable: right });
  }

  return;
}

/** Converts a left-variable inequality into a normalized lower or upper bound. */
function boundFromLeftVariable({
  bound,
  operator,
  variable,
}: {
  readonly bound: string;
  readonly operator: string;
  readonly variable: string;
}): ParsedBound {
  if (operator === ">" || operator === ">=") {
    return { bound, inclusive: operator === ">=", side: "lower", variable };
  }

  return { bound, inclusive: operator === "<=", side: "upper", variable };
}

/** Converts a right-variable inequality into a normalized lower or upper bound. */
function boundFromRightVariable({
  bound,
  operator,
  variable,
}: {
  readonly bound: string;
  readonly operator: string;
  readonly variable: string;
}): ParsedBound {
  if (operator === ">" || operator === ">=") {
    return { bound, inclusive: operator === ">=", side: "upper", variable };
  }

  return { bound, inclusive: operator === "<=", side: "lower", variable };
}

/** Extracts a mathematical relation without changing identifiers or functions. */
function extractRelationFragments(expression: string) {
  const relationText = stripLeadingRelationDescriptor(
    stripLeadingSolveCommand(expression)
  );
  const chained = extractChainedBoundFragments(relationText);
  if (chained.length > 0) {
    return chained;
  }

  const match = RELATION_OPERATOR_PATTERN.exec(relationText);
  if (!match) {
    return [];
  }

  const operator = match[0];
  const left = relationText.slice(0, match.index);
  const right = relationText.slice(match.index + operator.length);
  const leftExpression = RELATION_LEFT_PATTERN.exec(left)?.[1]?.trim();
  const rightExpression = RELATION_RIGHT_PATTERN.exec(right)?.[1]?.trim();

  if (!(leftExpression && rightExpression)) {
    return [];
  }

  return [`${leftExpression} ${operator} ${rightExpression}`];
}

/** Removes learner command words before parsing relation syntax. */
function stripLeadingSolveCommand(expression: string) {
  return expression.replace(LEADING_SOLVE_COMMAND_PATTERN, "").trim();
}

/** Removes common equation descriptors before the actual relation. */
function stripLeadingRelationDescriptor(expression: string) {
  return expression.replace(LEADING_RELATION_DESCRIPTOR_PATTERN, "").trim();
}

/** Splits interval notation such as 0 < x < 2 into two bound relations. */
function extractChainedBoundFragments(expression: string) {
  const match = CHAINED_BOUND_PATTERN.exec(expression);
  const groups = match?.groups;
  if (!groups) {
    return [];
  }

  const left = String(groups.left).trim();
  const leftOperator = String(groups.leftOperator);
  const variable = String(groups.variable);
  const rightOperator = String(groups.rightOperator);
  const right = String(groups.right).trim();

  return [
    `${left} ${leftOperator} ${variable}`,
    `${variable} ${rightOperator} ${right}`,
  ];
}

/** Infers solve variables from relation symbols and normalized bounds. */
function inferSolveVariables(
  relations: readonly string[],
  bounds: SolveParts["bounds"]
) {
  const symbols = new Set(
    relations.flatMap((relation) => [...getExpressionSymbols(relation)])
  );
  if (bounds.variable) {
    symbols.add(bounds.variable);
  }

  return [...symbols];
}
