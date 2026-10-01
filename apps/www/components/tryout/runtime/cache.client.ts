import type { useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Option } from "effect";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

type OptimisticStore = Parameters<
  Parameters<ReturnType<typeof useMutation>["withOptimisticUpdate"]>[0]
>[0];

/**
 * Applies one optimistic runtime change to every cached section and set
 * query. A transform returning `null` leaves that cache untouched; Convex
 * drops the whole layer when the mutation fails, which is the rollback.
 */
export function updateTryoutRuntime(
  localStore: OptimisticStore,
  transform: (runtime: TryoutSectionRuntime) => TryoutSectionRuntime | null
) {
  updateQueries(
    localStore,
    refs.public.tryouts.queries.runtime.getSectionAttemptState,
    transform
  );
  updateQueries(
    localStore,
    refs.public.tryouts.queries.runtime.getSetAttemptState,
    transform
  );
}

/** Rewrites the runtime of each cached result of one query. */
function updateQueries<
  Query extends
    | typeof refs.public.tryouts.queries.runtime.getSectionAttemptState
    | typeof refs.public.tryouts.queries.runtime.getSetAttemptState,
>(
  localStore: OptimisticStore,
  query: Query,
  transform: (runtime: TryoutSectionRuntime) => TryoutSectionRuntime | null
) {
  for (const cached of localStore.getAllQueries(query)) {
    const state = Option.getOrUndefined(cached.value);
    if (!state?.runtime) {
      continue;
    }
    const runtime = transform(state.runtime);
    if (runtime) {
      localStore.setQuery(
        query,
        cached.args,
        Option.some({ ...state, runtime })
      );
    }
  }
}
