import {
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  PublicContentRuntimeFoundSchema,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import { Schema } from "effect";

/** Measures the exact JSON wire bytes of one decoded Aksara response. */
export function publicRuntimeBytes<Response>(response: Response) {
  return new TextEncoder().encode(JSON.stringify(response)).byteLength;
}

const PublicRuntimeByteCheck = Schema.makeFilter(
  (response: unknown) =>
    publicRuntimeBytes(response) <= MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  { message: "Public runtime exceeded the Aksara response ceiling." }
);

/** Exact Aksara public found response within its singular wire ceiling. */
export const BoundedPublicRuntimeFoundSchema =
  PublicContentRuntimeFoundSchema.pipe(Schema.check(PublicRuntimeByteCheck));

/** Exact Aksara public response within its singular wire ceiling. */
export const BoundedPublicRuntimeResponseSchema =
  PublicContentRuntimeResponseSchema.pipe(Schema.check(PublicRuntimeByteCheck));
