import { MAX_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import {
  type HttpBodyError,
  readJsonBody,
} from "@repo/backend/convex/contentRelease/http/body";
import { matchesHttpSecret } from "@repo/backend/convex/contentRelease/http/secret";
import {
  failureResult,
  type RuntimeHttpResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Either } from "effect";

const RUNTIME_PATH = "/internal/content/runtime";

const runtimeDispatchReference = makeFunctionReference<
  "action",
  { byteLength: number; source: string },
  RuntimeHttpResult
>("contentRelease/runtime/dispatch:dispatch");

/** Maps one shared bounded-body failure to its stable HTTP status. */
function bodyFailureResult(error: HttpBodyError) {
  if (error.reason === "size") {
    return failureResult("CONTENT_RUNTIME_INVALID", 413);
  }
  if (error.reason === "unsupported") {
    return failureResult("CONTENT_RUNTIME_INVALID", 415);
  }
  return failureResult("CONTENT_RUNTIME_INVALID", 400);
}

/** Authenticates and forwards one bounded request to the Node verifier. */
const runtimeRoute = Effect.fn("contentRelease.runtimeRoute")(function* (
  ctx: ActionCtx,
  request: Request
) {
  const trustedServer = yield* matchesHttpSecret(
    request.headers.get("x-nakafa-content-token") ?? "",
    env.CONTENT_RUNTIME_TOKEN
  ).pipe(Effect.either);
  if (Either.isLeft(trustedServer)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (!trustedServer.right) {
    return failureResult("CONTENT_RUNTIME_UNAUTHORIZED", 401);
  }
  const body = yield* readJsonBody(request, MAX_RUNTIME_REQUEST_BYTES).pipe(
    Effect.either
  );
  if (Either.isLeft(body)) {
    return bodyFailureResult(body.left);
  }
  return yield* Effect.promise(() =>
    ctx.runAction(runtimeDispatchReference, body.right)
  );
});

/** Registers the only server-authenticated executable-artifact read route. */
export function registerContentRuntimeRoute(app: HonoWithConvex<ActionCtx>) {
  app.post(RUNTIME_PATH, async (context) => {
    const result: RuntimeHttpResult = await runConvexProgram(
      runtimeRoute(context.env, context.req.raw)
    );
    return new Response(result.body, {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
      status: result.status,
    });
  });
}
