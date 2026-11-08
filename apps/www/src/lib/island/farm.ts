import type * as Ref from "@confect/core/Ref";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { harvestAt, waterPlants } from "@repo/backend/confect/island/farm";
import { growsOf } from "@repo/backend/confect/island/item";
import type { Placement } from "@repo/backend/confect/island/layout";
import { addMaterials } from "@repo/backend/confect/island/material";
import type { FarmRefused } from "@repo/backend/confect/island/schema";
import { Array as Arr, Option, Record, Result } from "effect";

/** The owner's island as its query answers it. */
type OwnIsland = NonNullable<Ref.Returns<typeof island.queries.own>>;

/**
 * Why the garden cannot be watered on `today`, none when it can (ADR 0042,
 * D13): the owner has not learned today, already watered today, or has no
 * plant. The server runs the same checks, so a refusal sends nothing.
 */
export function waterRefusal(
  garden: {
    readonly layout: readonly Placement[];
    readonly learned: Option.Option<string>;
    readonly watered: Option.Option<string>;
  },
  today: string
): Option.Option<FarmRefused["reason"]> {
  if (!Option.contains(garden.learned, today)) {
    return Option.some("unlearned");
  }
  if (Option.contains(garden.watered, today)) {
    return Option.some("watered");
  }
  return Option.isNone(waterPlants(garden.layout))
    ? Option.some("barren")
    : Option.none();
}

/**
 * The material a plant grown to its last stage gives when harvested, none for
 * anything else, which no harvest takes (ADR 0042, D13).
 */
export function ripeYield(placement: Placement) {
  return Option.flatMap(growsOf(placement.item), ({ days, yields }) =>
    placement.stage < days.length
      ? Option.none()
      : Option.map(
          Arr.findFirst(Record.toEntries(yields), ([, amount]) => amount > 0),
          ([material]) => material
        )
  );
}

/** The owner's island from the local store, none before it loads or when they have none. */
function ownIn(localStore: OptimisticLocalStore.OptimisticLocalStore) {
  return Option.flatMap(
    localStore.getQuery(island.queries.own, {}),
    Option.fromNullishOr
  );
}

/** Writes the owner's island back to the local store under the next version. */
function shown(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  own: OwnIsland,
  change: Partial<OwnIsland>
) {
  localStore.setQuery(
    island.queries.own,
    {},
    Option.some({ ...own, ...change, version: own.version + 1 })
  );
}

/**
 * Shows a watering at once (ADR 0042, D13): every plant one day further. The
 * owner can water only on the day they learned, so that day is the watering's.
 */
export const waterIslandChange: OptimisticUpdate<
  typeof island.mutations.water
> = (localStore) => {
  const own = ownIn(localStore);
  if (Option.isNone(own) || own.value.learned === undefined) {
    return;
  }
  const layout = waterPlants(own.value.layout);
  if (Option.isSome(layout)) {
    shown(localStore, own.value, {
      layout: layout.value,
      watered: own.value.learned,
    });
  }
};

/** Shows a harvest at once: the plant grown back and its materials added. */
export const harvestIslandChange: OptimisticUpdate<
  typeof island.mutations.harvest
> = (localStore, { at }) => {
  const own = ownIn(localStore);
  if (Option.isNone(own)) {
    return;
  }
  const harvested = harvestAt(own.value.layout, at);
  if (Result.isSuccess(harvested)) {
    shown(localStore, own.value, {
      layout: harvested.success.layout,
      materials: addMaterials(own.value.materials, harvested.success.yields),
    });
  }
};
