import { describe, expect, it } from "@effect/vitest";
import { HashSet } from "effect";
import { createExplainedStore } from "@/components/tryout/review/context";

describe("createExplainedStore", () => {
  it("opens a question's explanation, then closes it, apart from the others", () => {
    const store = createExplainedStore();

    store.getState().toggle("a");
    store.getState().toggle("b");
    store.getState().toggle("a");

    expect(HashSet.has(store.getState().open, "a")).toBe(false);
    expect(HashSet.has(store.getState().open, "b")).toBe(true);
  });

  it("gives each review its own explanations", () => {
    const first = createExplainedStore();
    first.getState().toggle("a");

    expect(HashSet.size(createExplainedStore().getState().open)).toBe(0);
  });
});
