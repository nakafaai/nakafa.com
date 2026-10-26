import type { useMutation } from "@confect/react";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Option } from "effect";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** The local store that an optimistic update of a try-out write changes. */
type OptimisticStore = Parameters<
  Parameters<ReturnType<typeof useMutation>["withOptimisticUpdate"]>[0]
>[0];

/** The cached runtime reads that hold the questions of a running section. */
type RuntimeQuery =
  | typeof tryouts.queries.runtime.getSectionAttemptState
  | typeof tryouts.queries.runtime.getSetAttemptState;

/**
 * Applies one optimistic change to the running section of every cached copy of
 * `query`. A copy without a running section, or one that `change` leaves alone
 * by returning none, stays as the server last sent it. Convex drops the change
 * with its mutation when the server refuses the write, which is the rollback.
 */
export function updateRuntimeQueries(
  localStore: OptimisticStore,
  query: RuntimeQuery,
  change: (runtime: TryoutSectionRuntime) => TryoutSectionRuntime | null
) {
  for (const cached of localStore.getAllQueries(query)) {
    const state = Option.getOrUndefined(cached.value);
    if (!state?.runtime) {
      continue;
    }
    const runtime = change(state.runtime);
    if (runtime) {
      localStore.setQuery(
        query,
        cached.args,
        Option.some({ ...state, runtime })
      );
    }
  }
}
