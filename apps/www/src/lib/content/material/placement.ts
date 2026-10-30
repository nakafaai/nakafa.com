import { readMaterialContextHint } from "@repo/contents/route/material/context";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { Effect, Option, Schema } from "effect";
import { createStore, type StoreApi } from "zustand";
import { reportClientException } from "@/lib/analytics/client";
import type {
  MaterialNavigationPage,
  MaterialPlacement,
} from "@/lib/content/material/navigation";

/**
 * The curriculum placement of one lesson page, as its links read it: none, as
 * the server renders the page, until the browser has verified the hint of the
 * reader's address.
 */
function initialPlacementState() {
  return { placement: Option.none<MaterialPlacement>() };
}

type PlacementState = ReturnType<typeof initialPlacementState>;

export type PlacementStore = StoreApi<PlacementState>;

/** Creates one lesson page's placement in the state the server renders. */
export function createPlacementStore(): PlacementStore {
  return createStore<PlacementState>(initialPlacementState);
}

/** The placement could not be read, so the lesson keeps its own links. */
export class PlacementReadFailed extends Schema.TaggedError<PlacementReadFailed>()(
  "PlacementReadFailed",
  { cause: Schema.Unknown }
) {}

/**
 * Reads the placement that the `ctx` hint of the reader's address names, after
 * the page has hydrated, and keeps it in the store. No build writes the answer of
 * a reader's hint, so the browser asks Convex itself, with the read loaded on
 * this first use, and the Worker answers nothing for it. An address without a
 * valid hint asks nothing and keeps no placement. A failed read is reported and
 * keeps the lesson's own links, which stay correct without a placement.
 */
export const startMaterialPlacement = Effect.fn(
  "www.materials.placement.start"
)(function* (
  store: PlacementStore,
  {
    ctx,
    locale,
    page,
  }: {
    readonly ctx: string | undefined;
    readonly locale: string;
    readonly page: MaterialNavigationPage;
  }
) {
  const context = ctx === undefined ? undefined : readMaterialContextHint(ctx);
  const appLocale = decodeLocale(locale);
  if (context === undefined || Option.isNone(appLocale)) {
    store.setState(initialPlacementState());
    return;
  }
  const placement = yield* Effect.tryPromise({
    try: () => import("@/lib/content/material/context"),
    catch: (cause) => new PlacementReadFailed({ cause }),
  }).pipe(
    Effect.flatMap(({ readPublishedMaterialPlacement }) =>
      readPublishedMaterialPlacement(appLocale.value, page.route, context).pipe(
        Effect.mapError((cause) => new PlacementReadFailed({ cause }))
      )
    ),
    Effect.catchTag("PlacementReadFailed", (error) =>
      reportClientException(error, { source: "material-placement" }).pipe(
        Effect.as(null)
      )
    )
  );
  store.setState({ placement: Option.fromNullishOr(placement) });
});
