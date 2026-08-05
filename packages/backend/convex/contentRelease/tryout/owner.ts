import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect, Option } from "effect";

/** Finds one active try-out snapshot whose question bodies are also active. */
export const findTryoutOwner = Effect.fn("contentRelease.findTryoutOwner")(
  function* (ctx: QueryCtx) {
    const selected = yield* loadActiveSnapshot(ctx, "tryout");
    if (!selected) {
      return Option.none();
    }
    const families = yield* loadReleaseFamilies(selected.active.release);
    if (!families.result.includes("question")) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The active try-out release does not own its signed questions."
      );
    }
    return Option.some(selected);
  }
);

/** Requires one active signed try-out snapshot for route-serving runtimes. */
export const loadTryoutOwner = Effect.fn("contentRelease.loadTryoutOwner")(
  function* (ctx: QueryCtx) {
    const selected = yield* findTryoutOwner(ctx);
    if (Option.isSome(selected)) {
      return selected.value;
    }

    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "The active signed try-out snapshot is unavailable."
    );
  }
);
