import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { warmMemoryEditor } from "@/components/user/settings/memory/module";

const loads = vi.hoisted(() => ({
  fail: false,
  preview: vi.fn(),
  rich: vi.fn(),
}));

vi.mock("@repo/design-system/components/editor/rich", () => {
  loads.rich();
  if (loads.fail) {
    throw new Error("The editor's code is unavailable.");
  }
  return {};
});

vi.mock("@repo/design-system/components/editor/words", () => {
  loads.preview();
  if (loads.fail) {
    throw new Error("The preview's code is unavailable.");
  }
  return {};
});

describe("warming the Memory editor", () => {
  it.effect(
    "does not load the editor's code before the learner shows intent",
    () =>
      Effect.sync(() => {
        expect(loads.rich).not.toHaveBeenCalled();
        expect(loads.preview).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "starts both loads on the first intent, and a load that fails does not stop the other",
    () =>
      Effect.gen(function* () {
        // Both loads fail on their first import, so each one must still start on its own.
        loads.fail = true;

        warmMemoryEditor();

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(loads.rich).toHaveBeenCalledTimes(1);
            expect(loads.preview).toHaveBeenCalledTimes(1);
          })
        );
      })
  );
});
