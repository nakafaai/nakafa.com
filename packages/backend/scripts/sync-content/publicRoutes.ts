import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import type { SyncOptions } from "@repo/backend/scripts/sync-content/types";
import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import type { PublicRouteProjectionError } from "@repo/contents/_types/route/path";
import { Effect, Option } from "effect";

type Locale = NonNullable<SyncOptions["locale"]>;

/** Resolves one source path through the contents-owned public route projection. */
export const readPublicContentRoute = Effect.fn("sync.readPublicContentRoute")(
  function* (sourcePath: string, locale: Locale) {
    const routeOption = yield* findPublicContentRouteBySourcePath(
      sourcePath,
      locale
    ).pipe(Effect.mapError(toPublicRouteFailure));

    if (Option.isSome(routeOption)) {
      return routeOption.value;
    }

    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Missing public route projection for ${locale}:${sourcePath}.`,
      })
    );
  }
);

/** Resolves only the public path for source rows that already carry metadata. */
export const readPublicContentPath = Effect.fn("sync.readPublicContentPath")(
  function* (sourcePath: string, locale: Locale) {
    const route = yield* readPublicContentRoute(sourcePath, locale);

    return route.publicPath;
  }
);

/** Converts route projection failures into the script failure channel used by sync. */
function toPublicRouteFailure(error: PublicRouteProjectionError) {
  return new ScriptFailureError({
    message: `Cannot project public route: ${error._tag}.`,
  });
}
