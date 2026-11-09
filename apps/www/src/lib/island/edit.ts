import type * as Ref from "@confect/core/Ref";
import type { OptimisticUpdate } from "@confect/react";
import island from "@repo/backend/confect/_generated/refs/island";
import { applyOperations } from "@repo/backend/confect/island/build";
import { growthOf } from "@repo/backend/confect/island/level";
import { Option, Result } from "effect";

/** The owner's island as its query answers it. */
type OwnIsland = NonNullable<Ref.Returns<typeof island.queries.own>>;

/** What the build rules read of the owner's island: its level, size, and spendable Stars and materials. */
export function buildContextOf(own: OwnIsland) {
  const growth = growthOf(own.lifetime);
  return {
    level: growth.level,
    materials: own.materials,
    size: growth.size,
    stars: own.stars,
  };
}

/**
 * Shows an edit on the owner's island at once, with the rules the server runs
 * (ADR 0042, D12): the new layout, the Stars and materials left and the next
 * version. A batch
 * the rules refuse changes nothing here, since the server refuses it too, and
 * Convex drops this change when the server answers either way.
 */
export const editIslandChange: OptimisticUpdate<
  typeof island.mutations.edit
> = (localStore, { operations }) => {
  const own = localStore.getQuery(island.queries.own, {});
  if (Option.isNone(own) || own.value === null) {
    return;
  }
  const edited = applyOperations(
    own.value.layout,
    operations,
    buildContextOf(own.value)
  );
  if (Result.isFailure(edited)) {
    return;
  }
  localStore.setQuery(
    island.queries.own,
    {},
    Option.some({
      ...own.value,
      layout: edited.success.layout,
      materials: edited.success.materials,
      stars: edited.success.stars,
      version: own.value.version + 1,
    })
  );
};

/**
 * Shows the owner's new choice of who may visit at once (ADR 0042, D20).
 * Convex drops it when the server answers either way.
 */
export const shareIslandChange: OptimisticUpdate<
  typeof island.mutations.share
> = (localStore, { visibility }) => {
  const own = localStore.getQuery(island.queries.own, {});
  if (Option.isNone(own) || own.value === null) {
    return;
  }
  localStore.setQuery(
    island.queries.own,
    {},
    Option.some({ ...own.value, visibility })
  );
};
