import { describe, expect, it } from "@effect/vitest";
import { Effect, MutableList } from "effect";
import { revertRefusedPause } from "@/components/user/settings/memory/pause";
import { createMemoryStore } from "@/components/user/settings/memory/store";

const refusal = new Error("The server refused the change.");

describe("a pause choice the server refuses", () => {
  it.effect("gives the choice back once the server refuses the change", () =>
    Effect.gen(function* () {
      const { getState } = createMemoryStore();
      getState().setPaused(true);

      yield* revertRefusedPause(
        getState().setPaused,
        Effect.fail(refusal),
        () => Effect.void
      );

      expect(getState().paused).toBeNull();
    })
  );

  it.effect("keeps the choice when the server takes the change", () =>
    Effect.gen(function* () {
      const { getState } = createMemoryStore();
      getState().setPaused(true);

      yield* revertRefusedPause(
        getState().setPaused,
        Effect.void,
        () => Effect.void
      );

      expect(getState().paused).toBe(true);
    })
  );

  it.effect(
    "tells the learner of the refusal before the choice goes back",
    () =>
      Effect.gen(function* () {
        const events = MutableList.make<unknown>();

        yield* revertRefusedPause(
          (paused) => {
            MutableList.append(events, paused);
          },
          Effect.fail(refusal),
          (error) =>
            Effect.sync(() => {
              MutableList.append(events, error);
            })
        );

        expect(MutableList.toArray(events)).toEqual([refusal, null]);
      })
  );
});
