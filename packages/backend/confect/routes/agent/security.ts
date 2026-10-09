import type { AgentEdgeContract } from "@repo/backend/agent/edge";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { matchesSecret } from "@repo/utilities/digest";
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
      matchesSecret(expected, supplied).pipe(
        Effect.mapError(
          (error) =>
            new NakafaAgentDataReadError({
              cause: getUnknownErrorMessage(error.reason.cause),
              message: "The public agent edge boundary is unavailable.",
            })
        )
      )
    );
    return Arr.some(comparisons, Boolean);
  }
);

/** Builds the typed fail-closed error for missing or malformed configuration. */
function unavailableEdgeSecret() {
  return new NakafaAgentDataReadError({
    message: "The public agent edge boundary is unavailable.",
  });
}
