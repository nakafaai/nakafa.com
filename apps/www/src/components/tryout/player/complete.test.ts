import { afterEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect, MutableRef } from "effect";
import { completeSection } from "@/components/tryout/player/complete";

const doubles = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: doubles.toastError },
}));

afterEach(() => {
  vi.clearAllMocks();
});

/** A finish that never reached the server. */
class Offline extends Data.TaggedError("Offline") {}

/** A leave that counts how often the finish went to the page that follows. */
function counted() {
  const left = MutableRef.make(0);
  return {
    leave: Effect.sync(() => MutableRef.increment(left)),
    left: () => MutableRef.get(left),
  };
}

describe("completeSection", () => {
  it.effect(
    "leaves for the page that follows once the server holds the finish, with no toast",
    () =>
      Effect.gen(function* () {
        const { leave, left } = counted();
        yield* completeSection(Effect.succeed("completed"), leave);

        expect(left()).toBe(1);
        expect(doubles.toastError).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "stays on the section with one toast when the finish fails, so the learner presses again",
    () =>
      Effect.gen(function* () {
        const { leave, left } = counted();
        yield* completeSection(Effect.fail(new Offline()), leave);

        expect(left()).toBe(0);
        expect(doubles.toastError).toHaveBeenCalledExactlyOnceWith(
          {
            description: "tryout-complete-part-error.description",
            title: "tryout-complete-part-error.title",
          },
          { position: "bottom-center" }
        );
      })
  );
});
