import { encodeMaterialContextHint } from "@repo/contents/route/material/context";
import { Array as Arr, Option, Order } from "effect";
import type { Locale } from "use-intl";
import { createStore, type StoreApi } from "zustand";
import type { MaterialPlacement } from "@/lib/content/material/navigation";

/** The curriculum placement of one lesson page, as its links read it. */
function placementState(placement: Option.Option<MaterialPlacement>) {
  return { placement };
}

type PlacementState = ReturnType<typeof placementState>;

export type PlacementStore = StoreApi<PlacementState>;

/** Creates one lesson page's placement: none, as the static page renders it. */
export function createPlacementStore(): PlacementStore {
  return createStore<PlacementState>(() => placementState(Option.none()));
}

/** The hint that a placement's links carry, which also names its path in the HTML. */
export function placementHint(placement: MaterialPlacement) {
  return encodeMaterialContextHint(placement.context);
}

/**
 * The placement of the lesson that the reader's `ctx` hint names, from the places
 * that the build wrote into the page. A hint the release does not hold finds none,
 * so a forged address names nothing.
 */
export function findPlacement(
  placements: readonly MaterialPlacement[],
  hint: string | undefined
) {
  return Arr.findFirst(
    placements,
    (placement) => placementHint(placement) === hint
  );
}

/** Keeps the placement that the reader's address names, or none. */
export function keepPlacement(
  store: PlacementStore,
  placement: Option.Option<MaterialPlacement>
) {
  store.setState(placementState(placement));
}

/**
 * A lesson's places in the order of the curriculum catalog, so its first place is
 * the curriculum the site leads with. A place of a curriculum that the catalog does
 * not list goes last.
 */
export function orderPlacements(
  placements: readonly MaterialPlacement[],
  programKeys: readonly string[]
) {
  const rank = ({ context }: MaterialPlacement) =>
    Option.getOrElse(
      Arr.findFirstIndex(programKeys, (key) => key === context.programKey),
      () => programKeys.length
    );
  return Arr.sort(placements, Order.mapInput(Order.Number, rank));
}

/**
 * The breadcrumb trails of a lesson, one for each curriculum place that holds it, in
 * the order the page lists them: home, then that place's curriculum pages. A lesson
 * that no curriculum places stands at home. The page draws every place's trail, so
 * its structured data names each one.
 */
export function readPlacementTrails(
  locale: Locale,
  home: string,
  placements: readonly MaterialPlacement[]
) {
  const root = { name: home, path: `/${locale}` };
  return Arr.match(placements, {
    onEmpty: () => Arr.of([root]),
    onNonEmpty: (places) =>
      Arr.map(places, ({ trail }) => [
        root,
        ...Arr.map(trail, ({ label, publicPath }) => ({
          name: label,
          path: `/${locale}/${publicPath}`,
        })),
      ]),
  });
}

/** What a lesson teaches in each curriculum: the curriculum, its unit, and the unit's address. */
export function readPlacementAlignments(
  locale: Locale,
  placements: readonly MaterialPlacement[]
) {
  return Arr.flatMap(placements, ({ hash, label, parent, trail }) =>
    Option.match(Arr.head(trail), {
      onNone: () => [],
      onSome: (program) => [
        {
          framework: program.label,
          path: `/${locale}/${parent.publicPath}#${hash}`,
          target: label,
        },
      ],
    })
  );
}
