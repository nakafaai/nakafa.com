import type { AgentEdgeContract } from "@repo/backend/agent/edge";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/agent/errors";
import { Array as Arr, Config, Effect } from "effect";

const MAX_EDGE_SECRETS = 2;

/** Reads and compares one edge secret without exposing it in diagnostics. */
export const hasValidEdgeSecret = Effect.fn("agent.hasValidEdgeSecret")(
  function* (request: Request, contract: AgentEdgeContract) {
    const configured = yield* Config.String(contract.secretEnvironment).pipe(
      Effect.mapError(unavailableEdgeSecret)
    );
    const acceptedSecrets = Arr.map(configured.split(","), (secret) =>
      secret.trim()
    );
    if (
      acceptedSecrets.length > MAX_EDGE_SECRETS ||
      Arr.some(acceptedSecrets, (secret) => secret.length === 0)
    ) {
      return yield* unavailableEdgeSecret();
    }
    const supplied = request.headers.get(contract.secretHeader);
    if (!supplied) {
      return false;
    }
    const comparisons = yield* Effect.forEach(acceptedSecrets, (expected) =>
      constantTimeEqual(expected, supplied)
    );
    return Arr.some(comparisons, Boolean);
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
  const left = new DataView(expectedDigest);
  const right = new DataView(suppliedDigest);
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference += Math.abs(left.getUint8(index) - right.getUint8(index));
  }
  return difference === 0;
});

/** Builds the typed fail-closed error for missing or malformed configuration. */
function unavailableEdgeSecret() {
  return new NakafaAgentDataReadError({
    message: "The public agent edge boundary is unavailable.",
  });
}
