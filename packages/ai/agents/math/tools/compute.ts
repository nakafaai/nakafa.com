import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData } from "@repo/math/schema/data";
import type { MathRequest } from "@repo/math/schema/request";
import { MathToolInputSchema } from "@repo/math/schema/tool-input";
import { MathService } from "@repo/math/service";
import type { UIMessageStreamWriter } from "ai";
import dedent from "dedent";
import { Effect, ParseResult, Schema } from "effect";

const invalidMathInputError = "invalid_math_input";
const mathCheckUnavailableError = "math_check_unavailable";

/** Gives the model actionable recovery guidance without exposing raw failures. */
function recoveryMessage(message: string) {
  if (message.includes("Variable is required when multiple symbols")) {
    return dedent(`
      Retry the same operation with the explicit variable from the user's original math notation.
      If no variable is clear, ask the user which variable to use.
    `);
  }

  return dedent(`
    Do not present this result as checked.
    Compare this failed input with the original task before answering.
    Retry the same operation if the task gives omitted variables, assumptions, domains, bounds, parameters, matrices, vectors, or data.
    Otherwise ask for the missing math data.
  `);
}

/** Formats schema validation errors for model-facing recovery decisions. */
function formatDecodeError(error: ParseResult.ParseError) {
  return ParseResult.TreeFormatter.formatErrorSync(error);
}

/** Gives the model a concrete retry path for invalid tool arguments. */
function decodeRecoveryMessage(message: string) {
  if (message.includes("Expected the constrained variable")) {
    return dedent(`
      Retry the same equation solve.
      Keep the same expressions, operation, variables, bounds, and inclusivity fields from the failed input.
      Add variable for the bounded variable from the user's domain restriction, for example x in x > 0.
    `);
  }

  return "Ask the user for the exact missing expression or data in their language.";
}

/** Runs one deterministic math request and writes the math evidence data part. */
export function compute({
  input,
  toolCallId,
  writer,
}: {
  input: unknown;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(MathToolInputSchema)(
      input
    ).pipe(Effect.either);

    if (decoded._tag === "Left") {
      const recovery = decodeRecoveryMessage(formatDecodeError(decoded.left));

      return [
        "# Checked Math Work",
        "- Status: error",
        `- Error code: ${invalidMathInputError}`,
        `- Recovery: ${recovery}`,
      ].join("\n");
    }

    const request = {
      ...decoded.right,
      kind: "math",
    } satisfies MathRequest;

    yield* Effect.sync(() =>
      writer.write({
        data: {
          input: request,
          kind: request.operation,
          status: "loading",
        },
        id: toolCallId,
        type: "data-math",
      })
    );

    const checked = yield* MathService.compute(request).pipe(Effect.either);

    const data =
      checked._tag === "Right"
        ? ({
            input: request,
            kind: checked.right.operation,
            result: checked.right,
            status: checked.right.status,
            summary: checked.right.status,
          } satisfies MathData)
        : ({
            error: mathCheckUnavailableError,
            input: request,
            kind: request.operation,
            status: "error",
          } satisfies MathData);

    yield* Effect.sync(() =>
      writer.write({
        data,
        id: toolCallId,
        type: "data-math",
      })
    );

    return formatMathData(
      data,
      checked._tag === "Left"
        ? recoveryMessage(checked.left.message)
        : undefined
    );
  });
}
