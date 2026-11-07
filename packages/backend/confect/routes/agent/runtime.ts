import { projectPublicApiPath } from "@repo/backend/agent/edge";
import type { AgentHttpInputError } from "@repo/backend/confect/routes/agent/input";
import { enforceAgentReadLimit } from "@repo/backend/confect/routes/agent/limit";
import {
  type AgentRateLimitError,
  agentQuotaHeaders,
} from "@repo/backend/confect/routes/agent/quota";
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
/**
 * Applies the application quota before reading or parsing content input. An
 * admitted read answers with the RateLimit fields, so a client can pace itself
 * before it meets a 429.
 */
export function runMeteredRequest<R>(
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError, R>
) {
  return runAgentRequest(
    request,
    requestId,
    enforceAgentReadLimit(request).pipe(
      Effect.flatMap((quota) =>
        Effect.map(program, (response) => {
          const fields = agentQuotaHeaders(quota);
          const headers = new Headers(response.headers);
          headers.set("RateLimit", fields.RateLimit);
          headers.set("RateLimit-Policy", fields["RateLimit-Policy"]);
          return new Response(response.body, {
            headers,
            status: response.status,
            statusText: response.statusText,
          });
        })
      )
    )
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
