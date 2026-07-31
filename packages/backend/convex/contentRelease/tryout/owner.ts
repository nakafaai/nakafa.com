import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

/** Selects one active try-out snapshot whose question bodies are also active. */
export const loadTryoutOwner = Effect.fn("contentRelease.loadTryoutOwner")(
  function* (ctx: QueryCtx) {
    const selected = yield* loadActiveSnapshot(ctx, "tryout");
    if (!selected) {
      return { managed: false, selected: null };
    }
    const families = yield* loadReleaseFamilies(selected.active.release);
    if (!families.result.includes("question")) {
      return { managed: false, selected };
    }
    return { managed: true, selected };
  }
);
