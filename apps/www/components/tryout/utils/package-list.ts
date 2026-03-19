import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type ActiveTryout = FunctionReturnType<
  typeof api.tryouts.queries.tryouts.getActiveTryouts
>[number];

export function groupActiveTryoutsByCycle(tryouts: readonly ActiveTryout[]) {
  const groupedTryouts = new Map<string, ActiveTryout[]>();

  for (const tryout of tryouts) {
    const cycleTryouts = groupedTryouts.get(tryout.cycleKey);

    if (cycleTryouts) {
      cycleTryouts.push(tryout);
      continue;
    }

    groupedTryouts.set(tryout.cycleKey, [tryout]);
  }

  return Array.from(groupedTryouts.entries()).map(([cycleKey, items]) => ({
    cycleKey,
    tryouts: items,
  }));
}
