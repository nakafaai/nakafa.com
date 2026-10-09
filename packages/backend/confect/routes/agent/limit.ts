import { NAKAFA_EDGE_CLIENT_IP_HEADER } from "@repo/backend/agent/edge";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { sha256Hex } from "@repo/utilities/digest";
import { Effect } from "effect";

const MAX_CLIENT_ADDRESS_LENGTH = 256;

/** Consumes one per-client public read token through the Convex component. */
export const enforceAgentReadLimit = Effect.fn("agent.enforceReadLimit")(
  function* (request: Request) {
    const { runMutation } = yield* MutationRunner;
    const key = yield* readClientKey(request);
    yield* runMutation(refs.internal.routes.agent.quota.consume, { key }).pipe(
      Effect.catchTag("SchemaError", (error) =>
        Effect.fail(
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(error),
            message: "The public API quota boundary is unavailable.",
          })
        )
      ),
      Effect.catchDefect(() =>
        Effect.fail(
          new NakafaAgentDataReadError({
            message: "The public API quota boundary is unavailable.",
          })
        )
      )
    );
  }
);

/** Derives a pseudonymous quota key from the trusted Vercel client address. */
const readClientKey = Effect.fn("agent.readClientKey")(function* (
  request: Request
) {
  const address = request.headers.get(NAKAFA_EDGE_CLIENT_IP_HEADER)?.trim();
  if (
    address === undefined ||
    address.length === 0 ||
    address.length > MAX_CLIENT_ADDRESS_LENGTH
  ) {
    return yield* new NakafaAgentDataReadError({
      message: "The public API quota identity is unavailable.",
    });
  }
  return yield* sha256Hex(address).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error.reason.cause),
          message: "The public API quota identity is unavailable.",
        })
    )
  );
});
