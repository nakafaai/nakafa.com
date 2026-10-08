import {
  type PublicationFailure,
  publicationFailureStatus,
} from "@nakafa/aksara-contracts/transport/failure";
import { MAX_PUBLICATION_RESPONSE_BYTES } from "@nakafa/aksara-contracts/transport/limits";
import { PublicationResponseSchema } from "@nakafa/aksara-contracts/transport/response";
import { Effect, Schema } from "effect";

/** Wire shape of one publication result: JSON body and exact HTTP status. */
const PublicationResultSchema = Schema.Struct({
  body: Schema.String,
  status: Schema.Finite,
});
/** JSON body and exact HTTP status returned by publication ingress. */
export type PublicationResult = typeof PublicationResultSchema.Type;
/** Marks a response-construction contradiction as a non-wire defect. */
export class PublicationResponseDefect extends Schema.TaggedError<PublicationResponseDefect>()(
  "PublicationResponseDefect",
  {
    reason: Schema.Literals(["contract", "size"]),
  }
) {}
/** Fails closed if one encoded response exceeds its complete body ceiling. */
export function validateResponseBytes(source: string) {
  const byteLength = new TextEncoder().encode(source).byteLength;
  return byteLength <= MAX_PUBLICATION_RESPONSE_BYTES
    ? Effect.void
    : Effect.die(
        new PublicationResponseDefect({
          reason: "size",
        })
      );
}
/** Strictly encodes one shared wire response and derives its canonical status. */
export const encodePublicationResult = Effect.fn(
  "contentRelease.encodePublicationResult"
)(function* (input: unknown) {
  const response = yield* Schema.decodeUnknownEffect(PublicationResponseSchema)(
    input,
    {
      onExcessProperty: "error",
    }
  ).pipe(
    Effect.catch(() =>
      Effect.die(
        new PublicationResponseDefect({
          reason: "contract",
        })
      )
    )
  );
  const body = yield* Schema.encodeEffect(
    Schema.fromJsonString(Schema.Unknown)
  )(response).pipe(
    Effect.catch(() =>
      Effect.die(
        new PublicationResponseDefect({
          reason: "contract",
        })
      )
    )
  );
  yield* validateResponseBytes(body);
  const status = response.ok
    ? 200
    : publicationFailureStatus(response.failure.code);
  return {
    body,
    status,
  } satisfies PublicationResult;
});
/** Encodes one success using the exact shared response vocabulary. */
export function publicationSuccess(response: unknown) {
  return encodePublicationResult(response);
}
/** Encodes one sanitized failure without exposing implementation messages. */
export function publicationFailure(failure: PublicationFailure) {
  return encodePublicationResult({
    failure,
    ok: false,
  });
}
