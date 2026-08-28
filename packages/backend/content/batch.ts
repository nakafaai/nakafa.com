import {
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  PublicContentRuntimeRequestSchema,
  type PublicContentRuntimeResponse,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import {
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES as MAX_PREDECESSOR_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeResponse as PredecessorPublicContentRuntimeResponse,
  PublicContentRuntimeResponseSchema as predecessorPublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-v150/runtime/spec";
import { Schema } from "effect";
/** Maximum exact Aksara public exchanges resolved by one batch transaction. */
export const PUBLIC_CONTENT_RUNTIME_BATCH_SIZE = 8;
const BATCH_JSON_OVERHEAD_BYTES = 64;
/** Complete request ceiling for one bounded public runtime batch. */
export const MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES =
  PUBLIC_CONTENT_RUNTIME_BATCH_SIZE * MAX_PUBLIC_RUNTIME_REQUEST_BYTES +
  BATCH_JSON_OVERHEAD_BYTES;
/** Complete response ceiling for one bounded public runtime batch. */
export const MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES =
  PUBLIC_CONTENT_RUNTIME_BATCH_SIZE * MAX_PUBLIC_RUNTIME_RESPONSE_BYTES +
  BATCH_JSON_OVERHEAD_BYTES;
/** Complete response ceiling for one bounded predecessor runtime batch. */
export const MAX_PREDECESSOR_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES =
  PUBLIC_CONTENT_RUNTIME_BATCH_SIZE *
    MAX_PREDECESSOR_PUBLIC_RUNTIME_RESPONSE_BYTES +
  BATCH_JSON_OVERHEAD_BYTES;
/** Measures the exact JSON wire bytes of one decoded Aksara response. */
export function publicRuntimeResponseBytes<Response>(response: Response) {
  return new TextEncoder().encode(JSON.stringify(response)).byteLength;
}
/** Nakafa batch of exact Aksara public runtime requests. */
export const PublicContentRuntimeBatchRequestSchema = Schema.Struct({
  requests: Schema.Array(PublicContentRuntimeRequestSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(PUBLIC_CONTENT_RUNTIME_BATCH_SIZE))
  ),
});
const PublicContentRuntimeBatchItemSchema =
  PublicContentRuntimeResponseSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (
          response
        ): response is Exclude<
          PublicContentRuntimeResponse,
          {
            kind: "failure";
          }
        > => response.kind !== "failure",
        { message: "Batch items contain only found or missing responses." }
      )
    ),
    Schema.check(
      Schema.makeFilter(
        (response) =>
          publicRuntimeResponseBytes(response) <=
          MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
        { message: "Batch item exceeded the Aksara response ceiling." }
      )
    )
  );
/** Nakafa batch of exact byte-bounded Aksara public runtime responses. */
export const PublicContentRuntimeBatchResponseSchema = Schema.Struct({
  responses: Schema.Array(PublicContentRuntimeBatchItemSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(PUBLIC_CONTENT_RUNTIME_BATCH_SIZE))
  ),
});
const PredecessorPublicContentRuntimeBatchItemSchema =
  predecessorPublicContentRuntimeResponseSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (
          response
        ): response is Exclude<
          PredecessorPublicContentRuntimeResponse,
          {
            kind: "failure";
          }
        > => response.kind !== "failure",
        { message: "Batch items contain only found or missing responses." }
      )
    ),
    Schema.check(
      Schema.makeFilter(
        (response) =>
          publicRuntimeResponseBytes(response) <=
          MAX_PREDECESSOR_PUBLIC_RUNTIME_RESPONSE_BYTES,
        { message: "Batch item exceeded the Aksara response ceiling." }
      )
    )
  );
/** Exact 0.15.0 response contract for one bounded predecessor batch. */
export const PredecessorPublicContentRuntimeBatchResponseSchema = Schema.Struct(
  {
    responses: Schema.Array(
      PredecessorPublicContentRuntimeBatchItemSchema
    ).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(PUBLIC_CONTENT_RUNTIME_BATCH_SIZE))
    ),
  }
);
