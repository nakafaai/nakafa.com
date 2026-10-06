import { projectPublicApiPath } from "@repo/backend/agent/edge";
import type { AgentHttpInputError } from "@repo/backend/confect/routes/agent/input";
import { enforceAgentReadLimit } from "@repo/backend/confect/routes/agent/limit";
import type { AgentRateLimitError } from "@repo/backend/confect/routes/agent/quota";
import {
  agentFailureResponse,
  httpInputFailureResponse,
  logInternalFailure,
} from "@repo/backend/confect/routes/agent/response";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/agent/errors";
import { Array as Arr, Cause, Effect, Option } from "effect";

type AgentDomainError =
  | AgentHttpInputError
  | AgentRateLimitError
  | NakafaAgentDataReadError
  | NakafaAgentInputError;
/** Applies the application quota before reading or parsing content input. */
export function runMeteredRequest<R>(
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError, R>
) {
  return runAgentRequest(
    request,
    requestId,
    enforceAgentReadLimit(request).pipe(Effect.flatMap(() => program))
  );
}

/** Projects typed agent failures at the native HTTP boundary. */
export function runAgentRequest<R>(
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError, R>
) {
  const instance = projectPublicApiPath(new URL(request.url).pathname);
  return program.pipe(
    Effect.matchCauseEffect({
      onFailure: (cause) => {
        const failure = Option.getOrUndefined(
          Arr.findFirst(cause.reasons, Cause.isFailReason)
        );
        if (!failure) {
          return logInternalFailure(cause, instance, requestId);
        }
        return Effect.succeed(
          failure.error._tag === "AgentHttpInputError"
            ? httpInputFailureResponse(failure.error, instance, requestId)
            : agentFailureResponse(failure.error, instance, requestId)
        );
      },
      onSuccess: Effect.succeed,
    })
  );
}
