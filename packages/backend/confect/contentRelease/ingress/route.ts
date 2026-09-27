import { ActionRunner } from "@confect/server";
import { MAX_PUBLICATION_REQUEST_BYTES } from "@nakafa/aksara-contracts/transport/limits";
import refs from "@repo/backend/confect/_generated/refs";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  type HttpBodyError,
  readJsonBody,
} from "@repo/backend/confect/contentRelease/http/body";
import {
  bearerToken,
  matchesHttpSecret,
} from "@repo/backend/confect/contentRelease/http/secret";
import { predecodeFailure } from "@repo/backend/confect/contentRelease/ingress/failure";
import { publicationFailure } from "@repo/backend/confect/contentRelease/ingress/response";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { type ActionCtx, env } from "@repo/backend/convex/_generated/server";
import { getConvexSize } from "convex/values";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result } from "effect";

const NODE_ACTION_ARGUMENT_BYTES = 5 * 1024 * 1024;
/** Converts an oversized Node argument envelope into a sanitized response. */
function rejectOversizedDispatch() {
  return publicationFailure(
    predecodeFailure(
      new ReleaseError({
        code: "CONTENT_RELEASE_SIZE",
        message: "Publication request was rejected before dispatch.",
      })
    )
  );
}
/** Converts one shared HTTP body rejection into publication wire semantics. */
function publicationBodyError(error: HttpBodyError) {
  if (error.reason === "size") {
    return new ReleaseError({
      code: "CONTENT_RELEASE_SIZE",
      message: "Content publication request body was rejected.",
    });
  }
  if (error.reason === "unsupported") {
    return new ReleaseError({
      code: "CONTENT_RELEASE_UNSUPPORTED",
      message: "Content publication request body was rejected.",
    });
  }
  return new ReleaseError({
    code: "CONTENT_RELEASE_INVALID_REQUEST",
    message: "Content publication request body was rejected.",
  });
}
/** Returns the single sanitized publication authentication rejection. */
function publicationAuthFailure() {
  return publicationFailure(
    predecodeFailure(
      new ReleaseError({
        code: "CONTENT_RELEASE_UNAUTHORIZED",
        message: "Content publication authentication failed.",
      })
    )
  );
}
/** Reads one bounded request and invokes the isolated Node verifier. */
const publicationRoute = Effect.fn("contentRelease.publicationRoute")(
  function* (ctx: ActionCtx, request: Request) {
    const runAction = yield* ActionRunner.ActionRunner.pipe(
      Effect.provide(ActionRunner.layer(ctx.runAction))
    );
    const authenticated = yield* matchesHttpSecret(
      bearerToken(request.headers.get("authorization") ?? ""),
      env.AKSARA_PUBLICATION_TOKEN
    ).pipe(Effect.result);
    if (Result.isFailure(authenticated) || !authenticated.success) {
      return yield* publicationAuthFailure();
    }
    const body = yield* readJsonBody(
      request,
      MAX_PUBLICATION_REQUEST_BYTES
    ).pipe(Effect.result);
    if (Result.isFailure(body)) {
      return yield* publicationFailure(
        predecodeFailure(publicationBodyError(body.failure))
      );
    }
    if (getConvexSize(body.success) > NODE_ACTION_ARGUMENT_BYTES) {
      return yield* rejectOversizedDispatch();
    }
    return yield* runAction(
      refs.internal.contentRelease.ingress.dispatch.dispatch,
      body.success
    ).pipe(Effect.orDie);
  }
);
/** Registers the single private content-publication ingress. */
export function registerContentReleaseRoutes<
  Variables extends Record<string, unknown>,
>(app: HonoWithConvex<ActionCtx, Variables>) {
  app.post("/internal/content/releases", async (context) => {
    const result = await runConvexProgram(
      publicationRoute(context.env, context.req.raw)
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
