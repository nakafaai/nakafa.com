import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData } from "@repo/math/schema/data";
import type { MathRequest } from "@repo/math/schema/request";
import { MathToolInputSchema } from "@repo/math/schema/tool-input";
import { MathService } from "@repo/math/service";
import type { Locale } from "@repo/utilities/locales";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Schema } from "effect";

/** User-facing message for incomplete math tool inputs. */
function inputErrorMessage(locale: Locale) {
  if (locale === "id") {
    return "Aku perlu ekspresi atau data matematikanya ditulis lebih lengkap sebelum bisa mengecek bagian ini.";
  }

  return "I need the math expression or data written more completely before I can check this part.";
}

/** User-facing message for math checks that cannot complete right now. */
function serviceErrorMessage(locale: Locale) {
  if (locale === "id") {
    return "Bagian ini belum bisa dicek sekarang. Coba tulis ekspresi atau datanya dengan lebih jelas.";
  }

  return "This part could not be checked right now. Please try again with the expression or data written clearly.";
}

/** Gives the model actionable recovery guidance without exposing raw failures. */
function recoveryMessage(message: string) {
  if (message.includes("Variable is required when multiple symbols")) {
    return "Retry the same operation with the explicit variable from the user's original math notation. If no variable is clear, ask the user which variable to use.";
  }

  return "Do not present this result as checked. Retry only if the original request gives enough information to correct the input; otherwise ask for the missing math data.";
}

/** Runs one deterministic math request and writes the math evidence data part. */
export function compute({
  input,
  locale,
  toolCallId,
  writer,
}: {
  input: unknown;
  locale: Locale;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(MathToolInputSchema)(
      input
    ).pipe(Effect.either);

    if (decoded._tag === "Left") {
      return [
        "# Checked Math Work",
        "- Status: error",
        `- Error: ${inputErrorMessage(locale)}`,
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
            error: serviceErrorMessage(locale),
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
