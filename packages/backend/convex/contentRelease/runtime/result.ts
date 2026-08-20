import {
  type ContentRuntimeFailureCodeSchema,
  ContentRuntimeFailureSchema,
} from "@nakafa/aksara-contracts/runtime/result";
import { Result, Schema } from "effect";

type ContentRuntimeFailureCode = typeof ContentRuntimeFailureCodeSchema.Type;
/** Encoded runtime response returned across the Node action boundary. */
export interface RuntimeHttpResult {
  readonly body: string;
  readonly status: number;
}
/** Encodes one sanitized runtime failure through the shared contract. */
export function failureResult(
  code: ContentRuntimeFailureCode,
  status: number
): RuntimeHttpResult {
  const failure = ContentRuntimeFailureSchema.make({ code, kind: "failure" });
  return { body: JSON.stringify(failure), status };
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
  const body = JSON.stringify(decoded.success);
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return failureResult("CONTENT_RUNTIME_RESPONSE_TOO_LARGE", 500);
  }
  return { body, status };
}
