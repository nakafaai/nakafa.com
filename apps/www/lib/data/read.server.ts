import "@tanstack/react-start/server-only";
import type { AnyPublicQuery, Args } from "@confect/core/Ref";
import { notFound } from "@tanstack/react-router";
import { Effect } from "effect";
import { preloadConfectQuery } from "@/lib/data/preload.server";

/** Whether a failed read is a real failure rather than one of the query's refusals. */
const isPreloadFailed = (error: { readonly _tag: string }): boolean =>
  error._tag === "PreloadFailed";

/**
 * A read that the screen cannot render without. A refusal of the query ends the
 * screen as not found, the answer of a viewer whom the server denies, and a real
 * failure stays a `PreloadFailed` that the screen's error boundary shows.
 */
export const readRequired = Effect.fn("www.data.readRequired")(function* <
  Query extends AnyPublicQuery,
>(ref: Query, args: Args<Query>, token: string | undefined) {
  return yield* preloadConfectQuery(ref, args, token).pipe(
    Effect.catchIf(
      (error) => !isPreloadFailed(error),
      () => Effect.die(notFound())
    )
  );
});

/**
 * A read of one part of a screen, which the viewer's view may not show. A refusal
 * of the query leaves the part without a loader value, so the part's live read
 * decides it. A real failure stays a `PreloadFailed`, so no failure is silent.
 */
export const readOptional = Effect.fn("www.data.readOptional")(function* <
  Query extends AnyPublicQuery,
>(ref: Query, args: Args<Query>, token: string | undefined) {
  return yield* preloadConfectQuery(ref, args, token).pipe(
    Effect.catchIf(
      (error) => !isPreloadFailed(error),
      () => Effect.undefined
    )
  );
});
