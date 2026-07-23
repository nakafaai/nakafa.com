import {
  ContentRuntimeResponseSchema,
  MAX_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { Either, Schema } from "effect";

const INTERNAL_BODY = JSON.stringify({
  code: "CONTENT_RUNTIME_INTERNAL",
  kind: "failure",
});

/** Encoded runtime response returned across the Node action boundary. */
export interface RuntimeHttpResult {
  readonly body: string;
  readonly status: number;
}

/** Returns the contract-safe internal failure used for encoding defects. */
export function internalResult(): RuntimeHttpResult {
  return { body: INTERNAL_BODY, status: 500 };
}

/** Strictly encodes one response and enforces the shared UTF-8 ceiling. */
export function encodeRuntimeResult(input: unknown, status: number) {
  const decoded = Schema.decodeUnknownEither(ContentRuntimeResponseSchema)(
    input,
    { onExcessProperty: "error" }
  );
  if (Either.isLeft(decoded)) {
    return internalResult();
  }
  const body = JSON.stringify(decoded.right);
  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength > MAX_RUNTIME_RESPONSE_BYTES) {
    return internalResult();
  }
  return { body, status } satisfies RuntimeHttpResult;
}

/** Encodes one sanitized runtime failure with its exact HTTP status. */
export function failureResult(
  code:
    | "CONTENT_RUNTIME_FORBIDDEN"
    | "CONTENT_RUNTIME_INTERNAL"
    | "CONTENT_RUNTIME_INVALID"
    | "CONTENT_RUNTIME_UNAUTHORIZED",
  status: number
) {
  return encodeRuntimeResult({ code, kind: "failure" }, status);
}
