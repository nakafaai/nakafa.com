import { CasEngine } from "@repo/math/cas/engine";
import { projectArtifacts } from "@repo/math/project/artifact";
import {
  MathCasAdapterError,
  MathReasoningInputError,
} from "@repo/math/reason/errors";
import { planCasRequest } from "@repo/math/reason/plan";
import { MathWorkRepository } from "@repo/math/reason/repo";
import type { VerificationLane } from "@repo/math/schema/lane";
import type { MathResult } from "@repo/math/schema/result";
import {
  type MathComputation,
  MathReasoningRequest,
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
          const createdAt = yield* Clock.currentTimeMillis;
          const lane = laneFromResult(computed);
          const stepLane = laneFromStepStatus(computed);
          const workId = buildWorkId({
            createdAt,
            operation: computed.operation,
            request: request.request,
          });
          const steps = deriveSteps({
            lane: stepLane,
            result: computed,
            workId,
          });
          const work = MathWork.make({
            assumptions: planningAssumptions(),
            computations: [canonicalComputation(computed)],
            createdAt,
            input: {
              givens: request.givens,
              kind: "prompt",
              locale: request.locale,
              objective: request.objective,
              text: request.request,
            },
            limitations: limitationsForResult(computed.operation, lane),
            plannedRequest,
            primaryResult: computed.secondary ?? computed.primary,
            status: lane === "speculative" ? "limited" : "ready",
            verification: {
              engine: "sympy",
              lane,
              reasonKey: verificationReasonKey(lane),
              source: `cas.${computed.operation}`,
              values: [
                { name: "lane", value: lane },
                { name: "operation", value: computed.operation },
              ],
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
            const repository = yield* MathWorkRepository;
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
  createdAt,
  operation,
  request,
}: {
  readonly createdAt: number;
  readonly operation: string;
  readonly request: string;
}) {
  return `math:${operation}:${createdAt}:${hashText(request)}`;
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
function limitationsForResult(
  operation: string,
  lane: VerificationLane
): MathWorkShape["limitations"] {
  if (lane !== "speculative") {
    return [];
  }

  return [
    {
      copyKey: "math-limitation-cas-inconclusive",
      lane: "speculative",
      source: `cas.${operation}`,
      values: [{ name: "operation", value: operation }],
    },
  ];
}

/** Builds the default planning assumption note as a localized copy key. */
function planningAssumptions(): MathWorkShape["assumptions"] {
  return [
    {
      copyKey: "math-assumption-planned-from-prompt",
      lane: "pedagogical",
      values: [],
    },
  ];
}

/** Selects the localized verification reason key for the work lane. */
function verificationReasonKey(lane: VerificationLane) {
  if (lane === "speculative") {
    return "math-verification-speculative";
  }

  return "math-verification-verified";
}
