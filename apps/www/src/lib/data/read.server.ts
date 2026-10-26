import type { AnyPublicQuery, Args } from "@confect/core/Ref";
import { notFound } from "@tanstack/react-router";
import { Effect } from "effect";
import { captureServerExceptionSafely } from "@/lib/analytics/exception.server";
import { PreloadFailed, preloadConfectQuery } from "@/lib/data/preload.server";

/** Whether a failed read is a real failure rather than one of the query's refusals. */
const isPreloadFailed = (error: { readonly _tag: string }): boolean =>
  error._tag === "PreloadFailed";

/**
 * Whether Convex found no session behind a token the request sent. The session
 * the token names may have ended, or the token passed its time on its way, and
 * the next read with a fresh token answers: it says nothing about the screen.
 */
const isPassingSessionRefusal = (
  error: { readonly _tag: string },
  token: string | undefined
): boolean => token !== undefined && error._tag === "SessionRequired";

/**
 * A read that the screen cannot render without. A refusal of the query ends the
 * screen as not found, the answer of a viewer whom the server denies, and a real
 * failure stays a `PreloadFailed` that the screen's error boundary shows. A sent
 * token that Convex no longer accepts is no denial of the screen, so it fails
 * as a `PreloadFailed` too, and trying again reads with a fresh token.
 */
export const readRequired = Effect.fn("www.data.readRequired")(function* <
  Query extends AnyPublicQuery,
>(ref: Query, args: Args<Query>, token: string | undefined) {
  return yield* preloadConfectQuery(ref, args, token).pipe(
    Effect.catchIf(
      (error) => !isPreloadFailed(error),
      (error) =>
        isPassingSessionRefusal(error, token)
          ? Effect.fail(new PreloadFailed({ cause: error }))
          : Effect.die(notFound())
    )
  );
});

/**
 * A read of one part of a screen, which the viewer's view may not show. A refusal
 * of the query leaves the part without a loader value, so the part's live read
 * decides it. A real failure is reported and leaves the part without a value too:
 * the failure of one part never fails the page, and the live read answers it.
 */
export const readOptional = Effect.fn("www.data.readOptional")(function* <
  Query extends AnyPublicQuery,
>(ref: Query, args: Args<Query>, token: string | undefined) {
  return yield* preloadConfectQuery(ref, args, token).pipe(
    Effect.catch((error) =>
      isPreloadFailed(error)
        ? captureServerExceptionSafely(error, {
            operation: ref.convexFunctionName,
            source: "data.readOptional",
          }).pipe(Effect.as(undefined))
        : Effect.undefined
    )
  );
});
