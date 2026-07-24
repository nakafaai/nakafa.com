import { MAX_TRYOUT_CONTENT_REQUEST_BYTES } from "@repo/backend/content/tryout";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import {
  type HttpBodyError,
  readJsonBody,
} from "@repo/backend/convex/contentRelease/http/body";
import { matchesHttpSecret } from "@repo/backend/convex/contentRelease/http/secret";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import {
  type TryoutContentHttpResult,
  tryoutContentFailure,
} from "@repo/backend/convex/tryouts/content/result";
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Either, Schema } from "effect";

const TRYOUT_CONTENT_PATH = "/internal/tryouts/content";

const dispatchReference = makeFunctionReference<
  "action",
  { byteLength: number; source: string; userId: Id<"users"> },
  TryoutContentHttpResult
>("tryouts/content/dispatch:dispatch");

/** Request user authentication failed before private content resolution. */
class TryoutContentAuthError extends Schema.TaggedError<TryoutContentAuthError>()(
  "TryoutContentAuthError",
  {}
) {}

/** Maps a bounded-body failure to its exact private response status. */
function bodyFailure(error: HttpBodyError) {
  if (error.reason === "size") {
    return tryoutContentFailure("TRYOUT_CONTENT_INVALID", 413);
  }
  if (error.reason === "unsupported") {
    return tryoutContentFailure("TRYOUT_CONTENT_INVALID", 415);
  }
  return tryoutContentFailure("TRYOUT_CONTENT_INVALID", 400);
}

/** Authenticates both server and user before reading request bytes. */
const authenticateRequest = Effect.fn("tryouts.authenticateContentRequest")(
  function* (ctx: ActionCtx, request: Request) {
    const trustedServer = yield* matchesHttpSecret(
      request.headers.get("x-nakafa-content-token") ?? "",
      env.CONTENT_RUNTIME_TOKEN
    ).pipe(Effect.either);
    if (Either.isLeft(trustedServer)) {
      return yield* Effect.fail(
        tryoutContentFailure("TRYOUT_CONTENT_INTERNAL", 500)
      );
    }
    if (!trustedServer.right) {
      return yield* Effect.fail(
        tryoutContentFailure("TRYOUT_CONTENT_UNAUTHORIZED", 401)
      );
    }

    const auth = yield* Effect.tryPromise({
      catch: () => new TryoutContentAuthError(),
      try: () => requireAuthForAction(ctx),
    }).pipe(Effect.either);
    if (Either.isLeft(auth)) {
      return yield* Effect.fail(
        tryoutContentFailure("TRYOUT_CONTENT_UNAUTHORIZED", 401)
      );
    }

    return auth.right.appUser._id;
  }
);

/** Dispatches one bounded private request after both authentication checks. */
const contentRoute = Effect.fn("tryouts.contentRoute")(function* (
  ctx: ActionCtx,
  request: Request
) {
  const authentication = yield* authenticateRequest(ctx, request).pipe(
    Effect.either
  );
  if (Either.isLeft(authentication)) {
    return authentication.left;
  }

  const body = yield* readJsonBody(
    request,
    MAX_TRYOUT_CONTENT_REQUEST_BYTES
  ).pipe(Effect.either);
  if (Either.isLeft(body)) {
    return bodyFailure(body.left);
  }

  return yield* Effect.promise(() =>
    ctx.runAction(dispatchReference, {
      ...body.right,
      userId: authentication.right,
    })
  );
});

/** Registers the private user-authenticated try-out content route. */
export function registerTryoutContentRoute(app: HonoWithConvex<ActionCtx>) {
  app.post(TRYOUT_CONTENT_PATH, async (context) => {
    const result: TryoutContentHttpResult = await runConvexProgram(
      contentRoute(context.env, context.req.raw)
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
