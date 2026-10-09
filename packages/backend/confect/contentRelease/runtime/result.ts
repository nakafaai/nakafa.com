import {
  type ContentRuntimeFailureCodeSchema,
  ContentRuntimeFailureSchema,
} from "@nakafa/aksara-contracts/runtime/result";
import { encodeJsonText } from "@repo/utilities/json";
import { Result, Schema } from "effect";

type ContentRuntimeFailureCode = typeof ContentRuntimeFailureCodeSchema.Type;
/** Encoded runtime response returned across the Node action boundary. */
export const RuntimeHttpResultSchema = Schema.Struct({
  body: Schema.String,
  status: Schema.Finite,
});
export type RuntimeHttpResult = typeof RuntimeHttpResultSchema.Type;
/** Encodes one sanitized runtime failure through the shared contract. */
export function failureResult(
  code: ContentRuntimeFailureCode,
  status: number
): RuntimeHttpResult {
  const failure = ContentRuntimeFailureSchema.make({
    code,
    kind: "failure",
  });
  return {
    body: encodeJsonText(failure),
    status,
  };
}
/** Strictly encodes one response and enforces its endpoint wire ceiling. */
export function encodeRuntimeResult<A, I>(
  schema: Schema.Codec<A, I, never, never>,
  maxBytes: number,
  input: unknown,
  status: number
): RuntimeHttpResult {
  const decoded = Schema.decodeUnknownResult(schema)(input, {
    onExcessProperty: "error",
  });
  if (Result.isFailure(decoded)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  const body = encodeJsonText(decoded.success);
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return failureResult("CONTENT_RUNTIME_RESPONSE_TOO_LARGE", 500);
  }
  return {
    body,
    status,
  };
}
