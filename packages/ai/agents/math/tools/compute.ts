import { formatMathData } from "@repo/ai/agents/math/format";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  type MathData,
  type MathRequest,
  MathToolInputSchema,
} from "@repo/math/schema";
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

    const data = yield* MathService.compute(request).pipe(
      Effect.map((result) => {
        const data = {
          input: request,
          kind: result.operation,
          result,
          status: result.status,
          summary: result.status,
        } satisfies MathData;

        return data;
      }),
      Effect.catchTags({
        MathCasRequestError: () =>
          Effect.succeed({
            error: serviceErrorMessage(locale),
            input: request,
            kind: request.operation,
            status: "error",
          } satisfies MathData),
        MathCasResponseError: () =>
          Effect.succeed({
            error: serviceErrorMessage(locale),
            input: request,
            kind: request.operation,
            status: "error",
          } satisfies MathData),
      })
    );

    yield* Effect.sync(() =>
      writer.write({
        data,
        id: toolCallId,
        type: "data-math",
      })
    );

    return formatMathData(data);
  });
}
