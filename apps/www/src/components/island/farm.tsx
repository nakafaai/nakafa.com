import type * as Ref from "@confect/core/Ref";
import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import island from "@repo/backend/confect/_generated/refs/island";
import { todayOf } from "@repo/backend/confect/island/day";
import type { Placement } from "@repo/backend/confect/island/layout";
import { toast } from "@repo/design-system/lib/toast/notify";
import { DateTime, Effect, Option, Result } from "effect";
import { useIsland } from "@/lib/island/context";
import {
  harvestIslandChange,
  ripeYield,
  waterIslandChange,
  waterRefusal,
} from "@/lib/island/farm";

/**
 * Says why the server refused a watering or a harvest. A refusal or a stale
 * version rolls the island back on its own, since Convex drops the optimistic
 * change when the mutation answers.
 */
function farmFailed(
  error: Ref.Error<typeof island.mutations.water>,
  source: string
) {
  if (error._tag === "FarmRefused") {
    toast.error({ title: `island-farm-${error.reason}.title` });
  } else if (error._tag === "IslandStale") {
    toast.error({ title: "island-stale.title" });
  } else {
    captureException(error, { source });
  }
}

/**
 * Waters the owner's garden (ADR 0042, D13). Today is read when they press, in
 * the island's zone, and the rules the server runs answer first, so a garden
 * that cannot be watered says why at once and sends nothing.
 */
export function useWaterIsland() {
  const { layout, owner, timeZone } = useIsland();
  const water = useMutation(island.mutations.water).withOptimisticUpdate(
    waterIslandChange
  );
  return () => {
    if (Option.isNone(owner)) {
      return;
    }
    const today = Effect.runSync(
      todayOf(DateTime.zoneMakeNamedUnsafe(timeZone))
    );
    const refusal = waterRefusal({ ...owner.value, layout }, today);
    if (Option.isSome(refusal)) {
      toast.error({ title: `island-farm-${refusal.value}.title` });
      return;
    }
    Effect.runFork(
      Effect.tryPromise(() => water({ version: owner.value.version })).pipe(
        Effect.flatMap((result) =>
          Effect.sync(() =>
            Result.match(result, {
              onFailure: (error) => farmFailed(error, "island-water"),
              onSuccess: () => toast.success({ title: "island-watered.title" }),
            })
          )
        ),
        Effect.catchTag("UnknownError", () => Effect.void)
      )
    );
  };
}

/** Harvests one ripe plant of the owner's island into materials, shown at once. */
export function useHarvestIsland() {
  const { owner } = useIsland();
  const harvest = useMutation(island.mutations.harvest).withOptimisticUpdate(
    harvestIslandChange
  );
  return (placement: Placement) => {
    const gives = ripeYield(placement);
    if (Option.isNone(owner) || Option.isNone(gives)) {
      return;
    }
    Effect.runFork(
      Effect.tryPromise(() =>
        harvest({
          at: { x: placement.x, y: placement.y, z: placement.z },
          version: owner.value.version,
        })
      ).pipe(
        Effect.flatMap((result) =>
          Effect.sync(() =>
            Result.match(result, {
              onFailure: (error) => farmFailed(error, "island-harvest"),
              onSuccess: () =>
                toast.success({
                  title: `island-harvested-${gives.value}.title`,
                }),
            })
          )
        ),
        Effect.catchTag("UnknownError", () => Effect.void)
      )
    );
  };
}
