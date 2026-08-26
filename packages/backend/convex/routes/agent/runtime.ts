import { projectPublicApiPath } from "@repo/backend/agent/edge";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { AgentHttpInputError } from "@repo/backend/convex/routes/agent/input";
import {
  type AgentRateLimitError,
  enforceAgentReadLimit,
} from "@repo/backend/convex/routes/agent/limit";
import {
  agentFailureResponse,
  httpInputFailureResponse,
  logInternalFailure,
} from "@repo/backend/convex/routes/agent/response";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Cause, Effect } from "effect";

type AgentDomainError =
  | AgentHttpInputError
  | AgentRateLimitError
  | NakafaAgentDataReadError
  | NakafaAgentInputError;

export type AgentApp = HonoWithConvex<ActionCtx, { requestId: string }>;

/** Applies the application quota before reading or parsing content input. */
export function runMeteredRequest(
  ctx: ActionCtx,
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError>
) {
  return runAgentRequest(
    request,
    requestId,
    enforceAgentReadLimit(ctx, request).pipe(Effect.flatMap(() => program))
  );
}

/** Runs one typed agent program at the Hono HTTP Action boundary. */
export function runAgentRequest(
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError>
) {
  const instance = projectPublicApiPath(new URL(request.url).pathname);
  return Effect.runPromise(
    program.pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) => {
          const failure = cause.reasons.find(Cause.isFailReason);
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
    )
  );
}
