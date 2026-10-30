import { readMaterialContextHint } from "@repo/contents/route/material/context";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { Effect, Option, Schema } from "effect";
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
 * the placement that a client navigation's loader read before the page commits.
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

/**
 * Reads the placement after a hard load has hydrated, where the static page
 * could not see the hint, and keeps it in the store.
 */
export const startMaterialPlacement = Effect.fn(
  "www.materials.placement.start"
)(function* (
  store: PlacementStore,
  input: Parameters<typeof readLessonPlacement>[0]
) {
  store.setState(
    placementState(Option.fromNullishOr(yield* readLessonPlacement(input)))
  );
});
