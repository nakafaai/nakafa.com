import type { ModelId } from "@repo/ai/config/model";
import {
  formatMathCapabilityEvidence,
  formatMathCapabilityFailure,
} from "@repo/ai/nina/capability/math-evidence";
import { capabilityResult } from "@repo/ai/nina/capability/result";
import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import { PedagogyNarrator } from "@repo/ai/nina/pedagogy/narrator";
import { PedagogyProjectionRepository } from "@repo/ai/nina/pedagogy/repo";
import { PedagogyProjection } from "@repo/ai/nina/pedagogy/schema";
import type { MathReasoningDataPart } from "@repo/ai/schema/data";
import type { MathToolInput } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import { MathReasoning } from "@repo/math/reason/service";
import {
  MathWorkResult,
  type MathWorkResultShape,
} from "@repo/math/schema/work";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Schema } from "effect";

interface RunMathCapabilityInput {
  readonly input: MathToolInput;
  readonly locale: Locale;
  readonly modelId: ModelId;
  readonly responseMessageIdentifier: string;
  readonly toolCallId: string;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}

/** Runs one deterministic MathReasoning capability call for Nina. */
export const runMathCapability = Effect.fn("nina.math.capability")(function* ({
  input,
  locale,
  modelId,
  responseMessageIdentifier,
  toolCallId,
  writer,
}: RunMathCapabilityInput) {
  const dataInput = {
    givens: [...input.given],
    objective: input.objective,
    request: input.request,
    requirements: [...(input.requirements ?? [])],
  };

  yield* writeMathReasoningDataPart({
    data: {
      input: dataInput,
      status: "loading",
    },
    toolCallId,
    writer,
  });

  const result = yield* MathReasoning.produceWork({
    givens: [...input.given],
    math: input.math,
    locale,
    objective: input.objective,
    persistence: "persist",
    projectionLevel: "school",
    request: input.request,
    requirements: [...(input.requirements ?? [])],
    responseMessageIdentifier,
    toolCallId,
  }).pipe(
    Effect.tapError(() =>
      writeMathReasoningDataPart({
        data: {
          errorKey: "math-error",
          input: dataInput,
          status: "error",
        },
        toolCallId,
        writer,
      })
    )
  );

  const data: MathReasoningDoneDataPart = {
    result: Schema.encodeSync(MathWorkResult)(result),
    status: "done",
  };

  yield* writeMathReasoningDataPart({ data, toolCallId, writer });

  const pedagogy = yield* writePedagogyProjection({
    locale,
    modelId,
    mathData: data,
    responseMessageIdentifier,
    result,
    toolCallId,
    writer,
  });

  return capabilityResult({
    capability: MATH_CAPABILITY,
    limitations: result.work.limitations.map(
      (limitation) => limitation.copyKey
    ),
    status: result.work.status === "ready" ? "available" : "limited",
    text: formatMathCapabilityEvidence({ pedagogy, result }),
  });
});

/** Writes the MathReasoning UI data part at the AI SDK stream boundary. */
function writeMathReasoningDataPart({
  data,
  toolCallId,
  writer,
}: {
  readonly data: MathReasoningDataPart;
  readonly toolCallId: string;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.sync(() =>
    writer.write({
      data,
      id: toolCallId,
      type: "data-math-reasoning",
    })
  );
}

/** Runs live pedagogy narration and writes the non-canonical UI data part. */
const writePedagogyProjection = Effect.fn("nina.math.pedagogy.write")(
  function* ({
    locale,
    modelId,
    mathData,
    responseMessageIdentifier,
    result,
    toolCallId,
    writer,
  }: {
    readonly locale: Locale;
    readonly mathData: MathReasoningDoneDataPart;
    readonly modelId: ModelId;
    readonly responseMessageIdentifier: string;
    readonly result: MathWorkResultShape;
    readonly toolCallId: string;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  }) {
    yield* writeMathReasoningDataPart({
      data: {
        ...mathData,
        pedagogy: {
          status: "loading",
          workId: result.work.workId,
        },
      },
      toolCallId,
      writer,
    });

    const narrator = yield* PedagogyNarrator;
    const repository = yield* PedagogyProjectionRepository;
    const projection = yield* narrator
      .narrate({
        locale,
        modelId,
        result,
      })
      .pipe(
        Effect.tap((projection) =>
          repository.save(projection, {
            responseMessageIdentifier,
            toolCallId,
          })
        ),
        Effect.either
      );

    if (projection._tag === "Left") {
      yield* writeMathReasoningDataPart({
        data: {
          ...mathData,
          pedagogy: {
            reason: projection.left.source,
            status: "error",
            workId: result.work.workId,
          },
        },
        toolCallId,
        writer,
      });

      return;
    }

    yield* writeMathReasoningDataPart({
      data: {
        ...mathData,
        pedagogy: {
          projection: Schema.encodeSync(PedagogyProjection)(projection.right),
          status: "done",
        },
        status: "done",
      },
      toolCallId,
      writer,
    });

    return projection.right;
  }
);

/** Builds bounded model-facing evidence when deterministic math is unavailable. */
export function failedMathCapability() {
  return capabilityResult({
    capability: MATH_CAPABILITY,
    limitations: ["math-error"],
    status: "failed",
    text: formatMathCapabilityFailure(),
  });
}

type MathReasoningDoneDataPart = Extract<
  MathReasoningDataPart,
  { status: "done" }
>;
