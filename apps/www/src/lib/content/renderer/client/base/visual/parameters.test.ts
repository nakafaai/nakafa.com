import { describe, expect, it } from "@effect/vitest";
import { createParameterStore } from "@/lib/content/renderer/client/base/visual/parameters";

describe("parameter store", () => {
  it("starts at each slider's value and moves one slider alone", () => {
    const store = createParameterStore({ a: 1, k: 2 });

    store.getState().move("a", 1.5);

    expect(store.getState().values).toStrictEqual({ a: 1.5, k: 2 });
  });
});
