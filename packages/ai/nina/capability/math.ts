import {
  formatMathCapabilityEvidence,
  formatMathCapabilityFailure,
} from "@repo/ai/nina/capability/mathEvidence";
import { capabilityResult } from "@repo/ai/nina/capability/result";
import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import type { MathToolInput } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import { MathReasoning } from "@repo/math/reason/service";
import type { MathData } from "@repo/math/schema/data";
import { MathWorkResult } from "@repo/math/schema/work";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Schema } from "effect";

interface RunMathCapabilityInput {
  readonly input: MathToolInput;
  readonly locale: Locale;
  readonly responseMessageIdentifier: string;
  readonly toolCallId: string;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}

/** Runs one deterministic MathReasoning capability call for Nina. */
export const runMathCapability = Effect.fn("nina.math.capability")(function* ({
  input,
  locale,
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

  yield* writeMathDataPart({
    data: {
      input: dataInput,
      status: "loading",
    },
    toolCallId,
    writer,
  });

  const result = yield* MathReasoning.produceWork({
    givens: [...input.given],
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
      writeMathDataPart({
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

  const data: MathData = {
    result: Schema.encodeSync(MathWorkResult)(result),
    status: "done",
  };

  yield* writeMathDataPart({ data, toolCallId, writer });

  return capabilityResult({
    capability: MATH_CAPABILITY,
    limitations: result.work.limitations.map(
      (limitation) => limitation.copyKey
    ),
    status: result.work.status === "ready" ? "available" : "limited",
    text: formatMathCapabilityEvidence({ result }),
  });
});

/** Writes the MathWork UI data part at the AI SDK stream boundary. */
function writeMathDataPart({
  data,
  toolCallId,
  writer,
}: {
  readonly data: MathData;
  readonly toolCallId: string;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.sync(() =>
    writer.write({
      data,
      id: toolCallId,
      type: "data-math",
    })
  );
}

/** Builds bounded model-facing evidence when deterministic math is unavailable. */
export function failedMathCapability() {
  return capabilityResult({
    capability: MATH_CAPABILITY,
    limitations: ["math-error"],
    status: "failed",
    text: formatMathCapabilityFailure(),
  });
}
