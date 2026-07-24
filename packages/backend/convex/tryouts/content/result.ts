import {
  MAX_TRYOUT_CONTENT_RESPONSE_BYTES,
  TryoutContentResponseSchema,
} from "@repo/backend/content/tryout";
import { Either, Schema } from "effect";

const INTERNAL_BODY = JSON.stringify({
  code: "TRYOUT_CONTENT_INTERNAL",
  kind: "failure",
});

/** Encoded private response returned across the Node action boundary. */
export interface TryoutContentHttpResult {
  readonly body: string;
  readonly status: number;
}

/** Returns the contract-safe internal failure used for encoding defects. */
export function internalTryoutContentResult(): TryoutContentHttpResult {
  return { body: INTERNAL_BODY, status: 500 };
}

/** Strictly encodes one response and enforces the private byte ceiling. */
export function encodeTryoutContentResult(input: unknown, status: number) {
  const decoded = Schema.decodeUnknownEither(TryoutContentResponseSchema)(
    input,
    { onExcessProperty: "error" }
  );
  if (Either.isLeft(decoded)) {
    return internalTryoutContentResult();
  }

  const body = JSON.stringify(decoded.right);
  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength > MAX_TRYOUT_CONTENT_RESPONSE_BYTES) {
    return internalTryoutContentResult();
  }

  return { body, status } satisfies TryoutContentHttpResult;
}

/** Encodes one sanitized route failure with its exact HTTP status. */
export function tryoutContentFailure(
  code:
    | "TRYOUT_CONTENT_INTERNAL"
    | "TRYOUT_CONTENT_INVALID"
    | "TRYOUT_CONTENT_UNAUTHORIZED",
  status: number
) {
  return encodeTryoutContentResult({ code, kind: "failure" }, status);
}
