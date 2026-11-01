import { encodeMaterialContextHint } from "@repo/contents/route/material/context";
import { Array as Arr, Option } from "effect";
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
