import { readMaterialContextHint } from "@repo/contents/route/material/context";
import { Effect, Option, Schema } from "effect";
import { createStore, type StoreApi } from "zustand";
import { reportClientException } from "@/lib/analytics/client";
import type {
  MaterialNavigationPage,
  MaterialPlacement,
} from "@/lib/content/material/navigation";
import { readMaterialPlacement } from "@/lib/content/material/placement.functions";
import { readStaticData } from "@/lib/static/data";

/**
 * The curriculum placement of one lesson page, as its links read it: none, as
 * the server renders the page, until the browser has verified the hint of the
 * reader's address.
 */
function initialPlacementState() {
  return { placement: Option.none<MaterialPlacement>() };
}

export type PlacementState = ReturnType<typeof initialPlacementState>;

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
 * the page has hydrated, and keeps it in the store. An address without a valid
 * hint asks nothing and keeps no placement. A failed read is reported and keeps
 * the lesson's own links, which stay correct without a placement.
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
  if (ctx === undefined || readMaterialContextHint(ctx) === undefined) {
    store.setState(initialPlacementState());
    return;
  }
  const placement = yield* Effect.tryPromise({
    try: () =>
      readStaticData(readMaterialPlacement, {
        contentKey: page.route.contentKey,
        ctx,
        locale,
        materialKey: page.route.materialKey,
        parentPath: page.route.parentPath,
        publicPath: page.route.publicPath,
      }),
    catch: (cause) => new PlacementReadFailed({ cause }),
  }).pipe(
    Effect.catchTag("PlacementReadFailed", (error) =>
      reportClientException(error, { source: "material-placement" }).pipe(
        Effect.as(null)
      )
    )
  );
  store.setState({ placement: Option.fromNullishOr(placement) });
});
