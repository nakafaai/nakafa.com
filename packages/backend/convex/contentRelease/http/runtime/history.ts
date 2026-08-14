import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { RETAINED_PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/history/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect } from "effect";

/** Authenticates and forwards one bounded attempt-owned history request. */
const retainedRuntimeRoute = Effect.fn("contentRelease.retainedRuntimeRoute")(
  function* (ctx: ActionCtx, request: Request) {
    const input = yield* readRuntimeRequest(
      request,
      env.CONTENT_RUNTIME_TOKEN,
      MAX_PROTECTED_RUNTIME_REQUEST_BYTES
    );
    if (input.kind === "rejected") {
      return input.result;
    }
    return yield* dispatchProgram(
      ctx,
      input.body.source,
      input.body.byteLength
    );
  }
);

/** Registers the isolated read-only endpoint for retained attempt bytes. */
export function registerRetainedProtectedContentRuntimeRoute(
  app: HonoWithConvex<ActionCtx>
) {
  app.post(RETAINED_PROTECTED_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      retainedRuntimeRoute(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
}
