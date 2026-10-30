import { readMaterialContextHint } from "@repo/contents/route/material/context";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { Effect, MutableHashMap, Option, Schema } from "effect";
import { createStore, type StoreApi } from "zustand";
import { reportClientException } from "@/lib/analytics/client";
import type {
  MaterialNavigationPage,
  MaterialPlacement,
} from "@/lib/content/material/navigation";

/** The curriculum placement of one lesson page, as its links read it. */
function placementState(placement: Option.Option<MaterialPlacement>) {
  return { placement };
}

type PlacementState = ReturnType<typeof placementState>;

export type PlacementStore = StoreApi<PlacementState>;

/**
 * Creates one lesson page's placement: none, as the server renders the page, or
 * the placement that the loader read in the browser before the page committed.
 */
export function createPlacementStore(
  initial: MaterialPlacement | null = null
): PlacementStore {
  return createStore<PlacementState>(() =>
    placementState(Option.fromNullishOr(initial))
  );
}

/** The placement could not be read, so the lesson keeps its own links. */
export class PlacementReadFailed extends Schema.TaggedError<PlacementReadFailed>()(
  "PlacementReadFailed",
  { cause: Schema.Unknown }
) {}

/**
 * Reads the placement that the `ctx` hint of the reader's address names, or
 * none. No build writes the answer of a reader's hint, so the browser asks
 * Convex itself, with the read loaded on this first use, and the Worker answers
 * nothing for it. An address without a valid hint asks nothing. A failed read is
 * reported and reads as none, which keeps the lesson's own links, and they stay
 * correct without a placement.
 */
export const readLessonPlacement = Effect.fn("www.materials.placement.read")(
  function* ({
    ctx,
    locale,
    page,
  }: {
    readonly ctx: string | undefined;
    readonly locale: string;
    readonly page: MaterialNavigationPage;
  }) {
    const context =
      ctx === undefined ? undefined : readMaterialContextHint(ctx);
    const appLocale = decodeLocale(locale);
    if (context === undefined || Option.isNone(appLocale)) {
      return null;
    }
    return yield* Effect.tryPromise({
      try: () => import("@/lib/content/material/context"),
      catch: (cause) => new PlacementReadFailed({ cause }),
    }).pipe(
      Effect.flatMap(({ readPublishedMaterialPlacement }) =>
        readPublishedMaterialPlacement(
          appLocale.value,
          page.route,
          context
        ).pipe(Effect.mapError((cause) => new PlacementReadFailed({ cause })))
      ),
      Effect.catchTag("PlacementReadFailed", (error) =>
        reportClientException(error, { source: "material-placement" }).pipe(
          Effect.as(null)
        )
      )
    );
  }
);

/** Keeps the placement that the page's loader read in the browser, or none. */
export function keepPlacement(
  store: PlacementStore,
  placement: MaterialPlacement | null
) {
  store.setState(placementState(Option.fromNullishOr(placement)));
}

/**
 * The placement reads of this page session, one for each lesson and hint. The
 * router keys a lesson's match by its path alone, because the static page must
 * hydrate under any hint, so the loader's read does not always belong to the
 * address that the reader is on, and the provider then reads it itself. Both go
 * through the same read, so a lesson and hint cost one Convex query.
 */
const placementReads = MutableHashMap.empty<
  string,
  Effect.Effect<MaterialPlacement | null>
>();

/** Reads the placement that one lesson and hint name, once a page session. */
export const readLessonPlacementOnce = Effect.fn(
  "www.materials.placement.readOnce"
)(function* (input: Parameters<typeof readLessonPlacement>[0]) {
  const key = `${input.locale}/${input.page.route.publicPath}?${input.ctx ?? ""}`;
  const earlier = MutableHashMap.get(placementReads, key);
  if (Option.isSome(earlier)) {
    return yield* earlier.value;
  }
  const read = yield* Effect.cached(readLessonPlacement(input));
  MutableHashMap.set(placementReads, key, read);
  return yield* read;
});
