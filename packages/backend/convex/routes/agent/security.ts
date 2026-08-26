import type { AgentEdgeContract } from "@repo/backend/agent/edge";
import { env } from "@repo/backend/convex/_generated/server";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";

const MAX_EDGE_SECRETS = 2;

/** Reads and compares one edge secret without exposing it in diagnostics. */
export const hasValidEdgeSecret = Effect.fn("agent.hasValidEdgeSecret")(
  function* (request: Request, contract: AgentEdgeContract) {
    const configured = yield* Effect.sync(
      () => env[contract.secretEnvironment]
    );
    if (!configured) {
      return yield* unavailableEdgeSecret();
    }

    const acceptedSecrets = configured
      .split(",")
      .map((secret) => secret.trim());
    if (
      acceptedSecrets.length > MAX_EDGE_SECRETS ||
      acceptedSecrets.some((secret) => secret.length === 0)
    ) {
      return yield* unavailableEdgeSecret();
    }

    const supplied = request.headers.get(contract.secretHeader);
    if (!supplied) {
      return false;
    }

    const comparisons = yield* Effect.all(
      acceptedSecrets.map((expected) => constantTimeEqual(expected, supplied))
    );
    return comparisons.some(Boolean);
  }
);

/** Compares secret values through fixed-size SHA-256 digests. */
const constantTimeEqual = Effect.fn("agent.constantTimeEqual")(function* (
  expected: string,
  supplied: string
) {
  const [expectedDigest, suppliedDigest] = yield* Effect.tryPromise({
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "The public agent edge boundary is unavailable.",
      }),
    try: () =>
      Promise.all([
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(supplied)),
      ]),
  });
  const left = new Uint8Array(expectedDigest);
  const right = new Uint8Array(suppliedDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference += Math.abs((left[index] ?? 0) - (right[index] ?? 0));
  }
  return difference === 0;
});

/** Builds the typed fail-closed error for missing or malformed configuration. */
function unavailableEdgeSecret() {
  return new NakafaAgentDataReadError({
    message: "The public agent edge boundary is unavailable.",
  });
}
