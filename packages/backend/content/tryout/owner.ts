import { loadActiveSnapshot } from "@repo/backend/content/snapshot/read";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect, Option } from "effect";

/** Finds one active try-out snapshot whose question bodies are also active. */
export const findTryoutOwner = Effect.fn("contentRelease.findTryoutOwner")(
  function* () {
    const selected = yield* loadActiveSnapshot("tryout");
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
  function* () {
    const selected = yield* findTryoutOwner();
    if (Option.isSome(selected)) {
      return selected.value;
    }

    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "The active signed try-out snapshot is unavailable."
    );
  }
);
