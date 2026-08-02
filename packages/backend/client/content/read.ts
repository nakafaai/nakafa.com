import "server-only";

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
} from "@repo/backend/client/content/errors";
import {
  type ContentRuntimeTarget,
  fetchContentRuntime,
} from "@repo/backend/client/content/request";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { verifyContentEnvelope } from "@repo/backend/content/verify";
import { Effect } from "effect";

/** Reads and authenticates one exact public or protected content artifact. */
export const readContent = Effect.fn("NakafaContent.readContent")(function* (
  target: ContentRuntimeTarget,
  input: unknown
) {
  const exchange = yield* fetchContentRuntime(target, input);
  const verified = yield* verifyContentEnvelope({
    request: exchange.request,
    response: exchange.response,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
    Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
  );

  if (verified.kind === "missing") {
    return yield* new ContentRuntimeMissingError({
      request: exchange.request,
    });
  }
  if (verified.kind === "failure") {
    return yield* new ContentRuntimeFailureError({
      code: verified.code,
      status: exchange.status,
    });
  }

  return verified;
});
