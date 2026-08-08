import { MAX_PROTECTED_RUNTIME_REQUEST_BYTES } from "@nakafa/aksara-contracts/runtime/protected/limits";
import { PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { readRuntimeRequest } from "@repo/backend/convex/contentRelease/http/runtime/request";
import { privateRuntimeResponse } from "@repo/backend/convex/contentRelease/http/runtime/response";
import { dispatchProgram } from "@repo/backend/convex/contentRelease/runtime/protected/dispatch";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect } from "effect";

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
    return yield* dispatchProgram(
      ctx,
      input.body.source,
      input.body.byteLength
    );
  }
);

/** Registers the server-authenticated retained protected content read route. */
export function registerProtectedContentRuntimeRoute(
  app: HonoWithConvex<ActionCtx>
) {
  app.post(PROTECTED_CONTENT_RUNTIME_PATH, async (context) => {
    const result = await runConvexProgram(
      protectedRuntimeRoute(context.env, context.req.raw)
    );
    return privateRuntimeResponse(result);
  });
}
