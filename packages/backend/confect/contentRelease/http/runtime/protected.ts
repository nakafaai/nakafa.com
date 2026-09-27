import { ActionRunner } from "@confect/server";
import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import refs from "@repo/backend/confect/_generated/refs";
import { readRuntimeRequest } from "@repo/backend/confect/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/confect/contentRelease/http/runtime/response";
import { failureResult } from "@repo/backend/confect/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, flow, Result, Schema } from "effect";

/** The isolated Node verifier could not return one sanitized response. */
class ProtectedRuntimeActionError extends Schema.TaggedError<ProtectedRuntimeActionError>()(
  "ProtectedRuntimeActionError",
  {}
) {}

/** Calls the Node-only verifier without exposing an action failure. */
const dispatchProtectedRuntime = Effect.fn(
  "contentRelease.dispatchProtectedRuntime"
)(function* (
  ctx: ActionCtx,
  input: {
    readonly byteLength: number;
    readonly source: string;
  }
) {
  const runAction = yield* ActionRunner.ActionRunner.pipe(
    Effect.provide(ActionRunner.layer(ctx.runAction))
  );
  const result = yield* runAction(
    refs.internal.contentRelease.runtime.tryout.dispatch.dispatch,
    input
  ).pipe(
    Effect.mapError(() => new ProtectedRuntimeActionError()),
    Effect.catchDefect(
      flow(() => new ProtectedRuntimeActionError(), Effect.fail)
    ),
    Effect.result
  );
  return Result.isFailure(result)
    ? failureResult("CONTENT_RUNTIME_INTERNAL", 500)
    : result.success;
});

/** Authenticates and forwards one bounded protected runtime request. */
const protectedRuntimeRoute = Effect.fn("contentRelease.protectedRuntimeRoute")(
  function* (ctx: ActionCtx, request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      env.CONTENT_RUNTIME_TOKEN,
      MAX_PROTECTED_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchProtectedRuntime(ctx, input.body);
  }
);

/** Registers the server-authenticated protected content read route. */
export function registerProtectedContentRuntimeRoute<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post(PROTECTED_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      protectedRuntimeRoute(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
}
