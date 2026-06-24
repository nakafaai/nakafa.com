import { CasEngine } from "@repo/math/cas/engine";
import { projectArtifacts } from "@repo/math/project/artifact";
import { formulaExpressionForComputation } from "@repo/math/project/formula";
import {
  MathCasAdapterError,
  MathReasoningInputError,
} from "@repo/math/reason/errors";
import { planCasRequest } from "@repo/math/reason/plan";
import { MathWorkRepository } from "@repo/math/reason/repo";
import {
  type MathCopyValue,
  mathEvidenceRefValueName,
} from "@repo/math/schema/copy";
import type { VerificationLane } from "@repo/math/schema/lane";
import type { MathRequest } from "@repo/math/schema/request";
import type { MathResult } from "@repo/math/schema/result";
import {
  type MathComputation,
  MathReasoningRequest,
  type MathReasoningRequestShape,
  MathWork,
  MathWorkResult,
  type MathWorkShape,
} from "@repo/math/schema/work";
import { deriveSteps } from "@repo/math/steps/derive";
import { laneFromResult, laneFromStepStatus } from "@repo/math/verify/lane";
import { Clock, Effect, Layer, Schema } from "effect";

/** Deep MathReasoning Module Interface for canonical pedagogical math work. */
export class MathReasoning extends Effect.Service<MathReasoning>()(
  "@repo/math/MathReasoning",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const cas = yield* CasEngine;
      const repository = yield* MathWorkRepository;

      return {
        /** Produces canonical MathWork, derivation rows, artifacts, and optional persistence. */
        produceWork: Effect.fn("MathReasoning.produceWork")(function* (
          input: unknown
        ) {
          const request = yield* Schema.decodeUnknown(MathReasoningRequest)(
            input
          ).pipe(
            Effect.mapError(
              () =>
                new MathReasoningInputError({
                  message: "Invalid MathReasoning request.",
                })
            )
          );
          const plannedRequest = yield* planCasRequest(request);
          const computed = yield* cas.compute(plannedRequest).pipe(
            Effect.mapError(
              (error) =>
                new MathCasAdapterError({
                  message: error.message,
                })
            )
          );
          const generatedAt = yield* Clock.currentTimeMillis;
          const lane = laneFromResult(computed);
          const stepLane = laneFromStepStatus(computed);
          const workId = buildWorkId({
            generatedAt,
            operation: computed.operation,
            request: request.request,
          });
          const computation = canonicalComputation(computed);
          const primaryResult = formulaExpressionForComputation(computation);
          const steps = deriveSteps({
            lane: stepLane,
            result: computed,
            workId,
          });
          const work = MathWork.make({
            assumptions: planningAssumptions({
              plannedRequest,
              request,
              workId,
            }),
            computations: [computation],
            input: {
              givens: request.givens,
              kind: "prompt",
              locale: request.locale,
              objective: request.objective,
              requirements: request.requirements,
              text: request.request,
            },
            limitations: limitationsForResult({
              lane,
              result: computed,
              workId,
            }),
            plannedRequest,
            primaryResult,
            status: lane === "speculative" ? "limited" : "ready",
            verification: {
              engine: "sympy",
              lane,
              reasonKey: verificationReasonKey(computed, lane),
              source: `cas.${computed.operation}`,
              values: verificationValues({
                input: computed.primary.expression,
                lane,
                operation: computed.operation,
                result: primaryResult.expression,
                workId,
              }),
            },
            workId,
          });
          const artifacts = projectArtifacts({
            lane,
            result: computed,
            steps,
            work,
          });
          const output = MathWorkResult.make({
            artifacts,
            steps,
            work,
          });

          if (request.persistence === "persist") {
            yield* repository.save(output, {
              responseMessageIdentifier: request.responseMessageIdentifier,
              toolCallId: request.toolCallId,
            });
          }

          return output;
        }),
      };
    }),
  }
) {
  static readonly Live = Layer.provide(
    MathReasoning.Default,
    CasEngine.Default
  );
}

/** Normalizes a CAS response into canonical evidence without CAS prose. */
function canonicalComputation(result: MathResult): MathComputation {
  return {
    conditions: result.conditions,
    input: result.input,
    items: result.items,
    kind: result.kind,
    operation: result.operation,
    primary: result.primary,
    ...(result.secondary ? { secondary: result.secondary } : {}),
    stepStatus: result.stepStatus,
    steps: result.steps,
    status: result.status,
  };
}

/** Builds a stable locally unique MathWork id from operation and prompt text. */
function buildWorkId({
  generatedAt,
  operation,
  request,
}: {
  readonly generatedAt: number;
  readonly operation: string;
  readonly request: string;
}) {
  return `math:${operation}:${generatedAt}:${hashText(request)}`;
}

/** Hashes prompt text into a compact deterministic suffix for evidence ids. */
function hashText(text: string) {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_007;
  }

  return hash.toString(36);
}

/** Builds semantic limitation notes for CAS results that cannot verify work. */
function limitationsForResult({
  lane,
  result,
  workId,
}: {
  readonly lane: VerificationLane;
  readonly result: MathResult;
  readonly workId: string;
}): MathWorkShape["limitations"] {
  if (lane !== "speculative") {
    return [];
  }

  return [
    {
      copyKey: "math-limitation-cas-inconclusive",
      lane: "speculative",
      source: `cas.${result.operation}`,
      values: evidenceValues(`${workId}:limitation:cas`, [
        { name: "input", value: result.primary.expression },
        { name: "operation", value: result.operation },
      ]),
    },
  ];
}

/** Builds concrete assumption notes from structured math request evidence. */
function planningAssumptions({
  plannedRequest,
  request,
  workId,
}: {
  readonly plannedRequest: MathRequest;
  readonly request: MathReasoningRequestShape;
  readonly workId: string;
}): MathWorkShape["assumptions"] {
  const notes: MathWorkShape["assumptions"] = [];
  const variableNote = variableAssumption(plannedRequest, workId);
  const pointNote = pointAssumption(plannedRequest, workId);
  const circleNote = circlePointAssumption(plannedRequest, workId);

  if (variableNote) {
    notes.push(variableNote);
  }

  notes.push(...boundAssumptions(plannedRequest, workId));

  if (pointNote) {
    notes.push(pointNote);
  }

  if (circleNote) {
    notes.push(circleNote);
  }

  if (!requirementsAppliedAsBounds({ plannedRequest, request })) {
    notes.push(...requirementAssumptions(request.requirements, workId));
  }

  return notes;
}

/** Returns whether solve requirements have already become concrete bounds. */
function requirementsAppliedAsBounds({
  plannedRequest,
  request,
}: {
  readonly plannedRequest: MathRequest;
  readonly request: MathReasoningRequestShape;
}) {
  return (
    plannedRequest.operation === "solve" &&
    request.requirements.length > 0 &&
    hasStructuredDomainBound(plannedRequest)
  );
}

/** Returns whether a planned solve request includes a concrete domain bound. */
function hasStructuredDomainBound(request: MathRequest) {
  return [request.lower, request.upper].some(isPresent);
}

/** Returns whether an optional semantic field is present. */
function isPresent(value: unknown) {
  return value !== undefined;
}

/** Selects the localized verification reason key for the work status and lane. */
function verificationReasonKey(result: MathResult, lane: VerificationLane) {
  if (result.status === "contradicted") {
    return "math-verification-contradicted";
  }

  if (lane === "speculative") {
    return "math-verification-speculative";
  }

  return "math-verification-verified";
}

/** Builds concrete values for the visible verification sentence. */
function verificationValues({
  input,
  lane,
  operation,
  result,
  workId,
}: {
  readonly input: string;
  readonly lane: VerificationLane;
  readonly operation: string;
  readonly result: string;
  readonly workId: string;
}) {
  return evidenceValues(`${workId}:verification:primary`, [
    { name: "input", value: input },
    { name: "lane", value: lane },
    { name: "operation", value: operation },
    { name: "result", value: result },
  ]);
}

/** Builds variable assumptions from structured variable fields. */
function variableAssumption(
  request: MathRequest,
  workId: string
): MathWorkShape["assumptions"][number] | undefined {
  if (request.variables && request.variables.length > 0) {
    const variables = request.variables.join(", ");
    const copyKey =
      request.variables.length === 1
        ? "math-assumption-variable"
        : "math-assumption-variables";

    return {
      copyKey,
      lane: "pedagogical",
      source: "request.variables",
      values: evidenceValues(`${workId}:assumption:variables`, [
        { name: "variable", value: variables },
        { name: "variables", value: variables },
      ]),
    };
  }

  if (!request.variable) {
    return;
  }

  return {
    copyKey: "math-assumption-variable",
    lane: "pedagogical",
    source: "request.variable",
    values: evidenceValues(`${workId}:assumption:variable`, [
      { name: "variable", value: request.variable },
      { name: "variables", value: request.variable },
    ]),
  };
}

/** Builds bound assumptions from structured lower and upper constraints. */
function boundAssumptions(
  request: MathRequest,
  workId: string
): MathWorkShape["assumptions"] {
  const notes: MathWorkShape["assumptions"] = [];
  const variable = request.variable ?? request.variables?.[0] ?? "x";

  if (request.lower !== undefined) {
    const operator = request.lowerInclusive === false ? ">" : "\\ge";

    notes.push({
      copyKey: "math-assumption-bound",
      lane: "pedagogical",
      source: "request.lower",
      values: evidenceValues(`${workId}:assumption:lower`, [
        {
          name: "condition",
          value: `${variable} ${request.lowerInclusive === false ? ">" : ">="} ${request.lower}`,
        },
        {
          name: "conditionLatex",
          value: boundConditionLatex({
            limit: request.lower,
            operator,
            variable,
          }),
        },
      ]),
    });
  }

  if (request.upper !== undefined) {
    const operator = request.upperInclusive === false ? "<" : "\\le";

    notes.push({
      copyKey: "math-assumption-bound",
      lane: "pedagogical",
      source: "request.upper",
      values: evidenceValues(`${workId}:assumption:upper`, [
        {
          name: "condition",
          value: `${variable} ${request.upperInclusive === false ? "<" : "<="} ${request.upper}`,
        },
        {
          name: "conditionLatex",
          value: boundConditionLatex({
            limit: request.upper,
            operator,
            variable,
          }),
        },
      ]),
    });
  }

  return notes;
}

/** Formats a structured solve bound as LaTeX for localized UI projection. */
function boundConditionLatex({
  limit,
  operator,
  variable,
}: {
  readonly limit: string;
  readonly operator: string;
  readonly variable: string;
}) {
  return `${variable} ${operator} ${limit}`;
}

/** Builds requirement assumptions from structured tool input requirements. */
function requirementAssumptions(
  requirements: readonly string[],
  workId: string
): MathWorkShape["assumptions"] {
  return requirements.map((requirement, index) =>
    requirementAssumption({ index, requirement, workId })
  );
}

/** Builds one requirement assumption note with a stable evidence reference. */
function requirementAssumption({
  index,
  requirement,
  workId,
}: {
  readonly index: number;
  readonly requirement: string;
  readonly workId: string;
}): MathWorkShape["assumptions"][number] {
  return {
    copyKey: "math-assumption-requirement",
    lane: "pedagogical",
    source: "request.requirements",
    values: evidenceValues(`${workId}:assumption:requirement:${index}`, [
      { name: "requirement", value: requirement },
    ]),
  };
}

/** Builds a point assumption for coordinate geometry requests. */
function pointAssumption(
  request: MathRequest,
  workId: string
): MathWorkShape["assumptions"][number] | undefined {
  if (!request.points || request.points.length === 0) {
    return;
  }

  return {
    copyKey: "math-assumption-points",
    lane: "pedagogical",
    source: "request.points",
    values: evidenceValues(`${workId}:assumption:points`, [
      { name: "points", value: request.points.map(pointText).join(", ") },
    ]),
  };
}

/** Builds the circle-radius semantic assumption for circle requests. */
function circlePointAssumption(
  request: MathRequest,
  workId: string
): MathWorkShape["assumptions"][number] | undefined {
  if (request.pointSemantics !== "circle-radius-point") {
    return;
  }

  return {
    copyKey: "math-assumption-circle-radius-point",
    lane: "pedagogical",
    source: "request.pointSemantics",
    values: evidenceValues(`${workId}:assumption:circle-radius`, []),
  };
}

/** Formats one structured coordinate point for assumption values. */
function pointText(point: { readonly x: string; readonly y: string }) {
  return `(${point.x}, ${point.y})`;
}

/** Prepends a deterministic evidence reference to localization values. */
function evidenceValues(
  evidenceRef: string,
  values: readonly MathCopyValue[]
): MathCopyValue[] {
  return [{ name: mathEvidenceRefValueName, value: evidenceRef }, ...values];
}
