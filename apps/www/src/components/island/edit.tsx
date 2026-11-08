import { useMutation } from "@confect/react";
import { captureException } from "@repo/analytics/posthog/capture";
import island from "@repo/backend/confect/_generated/refs/island";
import {
  applyOperations,
  type Operation,
} from "@repo/backend/confect/island/build";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Result } from "effect";
import { useToolStore } from "@/components/island/tools";
import { useIsland } from "@/lib/island/context";
import { editIslandChange } from "@/lib/island/edit";

/** Which history an edit belongs to: a new edit, an undo, or a redo. */
type Step = "edit" | "redo" | "undo";

/**
 * Edits the owner's island (ADR 0042, D12). The rules run here first, so a
 * refused change says why at once and sends nothing; an accepted batch shows at
 * once through the optimistic change, its undo joins the right history, and the
 * mutation carries the version it was made against. A refusal or a stale
 * version from the server rolls the island back and forgets the history, which
 * no longer matches the island.
 */
export function useEditIsland() {
  const { layout, owner, size } = useIsland();
  const tools = useToolStore();
  const edit = useMutation(island.mutations.edit).withOptimisticUpdate(
    editIslandChange
  );
  return (operations: readonly Operation[], step: Step) => {
    if (Option.isNone(owner)) {
      return false;
    }
    const applied = applyOperations(layout, operations, {
      level: owner.value.level,
      size,
      stars: owner.value.stars,
    });
    if (Result.isFailure(applied)) {
      toast.error({ title: `island-refused-${applied.failure.reason}.title` });
      return false;
    }
    if (step === "undo") {
      tools.getState().undone(applied.success.undo);
    } else if (step === "redo") {
      tools.getState().redone(applied.success.undo);
    } else {
      tools.getState().record(applied.success.undo);
    }
    Effect.runFork(
      Effect.tryPromise(() =>
        edit({ operations, version: owner.value.version })
      ).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onFailure: (error) =>
              Effect.sync(() => {
                tools.getState().forget();
                if (error._tag === "IslandStale") {
                  toast.error({ title: "island-stale.title" });
                } else if (error._tag === "BuildRefused") {
                  toast.error({
                    title: `island-refused-${error.reason}.title`,
                  });
                } else {
                  captureException(error, { source: "island-edit" });
                }
              }),
            onSuccess: () => Effect.void,
          })
        ),
        Effect.catchTag("UnknownError", () =>
          Effect.sync(() => tools.getState().forget())
        )
      )
    );
    return true;
  };
}
