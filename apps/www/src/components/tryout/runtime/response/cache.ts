import type { OptimisticLocalStore } from "@confect/react";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Option } from "effect";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** The cached runtime queries that a write to one question changes. */
type RuntimeQuery =
  | typeof tryouts.queries.runtime.getSectionAttemptState
  | typeof tryouts.queries.runtime.getSetAttemptState;

/**
 * Applies one optimistic change to the runtime that every cached copy of `query` holds. A `change` that
 * returns `null` leaves its copy as the server last sent it.
 */
export function updateRuntimeQueries<Query extends RuntimeQuery>(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  query: Query,
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
        Option.some({
          ...state,
          runtime,
        })
      );
    }
  }
}
