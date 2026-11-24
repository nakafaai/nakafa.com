import { describe, expect, it } from "@effect/vitest";
import { HashSet } from "effect";
import {
  createExplainedStore,
  isExplanationOpen,
} from "@/components/tryout/review/context";

describe("createExplainedStore", () => {
  it("opens a question's explanation, then closes it, apart from the others", () => {
    const store = createExplainedStore();

    expect(store.getState().toggle("a")).toBe(true);
    expect(store.getState().toggle("b")).toBe(true);
    expect(store.getState().toggle("a")).toBe(false);

    expect(isExplanationOpen(store.getState(), "a")).toBe(false);
    expect(isExplanationOpen(store.getState(), "b")).toBe(true);
    expect(isExplanationOpen(store.getState(), "c")).toBe(false);
  });

  it("opens every explanation globally so navigating to other questions keeps them open", () => {
    const store = createExplainedStore();

    expect(store.getState().toggleAll("a")).toBe(true);
    expect(store.getState().allOpen).toBe(true);
    expect(HashSet.size(store.getState().overrides)).toBe(0);
    expect(isExplanationOpen(store.getState(), "a")).toBe(true);
    expect(isExplanationOpen(store.getState(), "b")).toBe(true);

    // Individual toggle closes only that question while others stay open.
    expect(store.getState().toggle("a")).toBe(false);
    expect(isExplanationOpen(store.getState(), "a")).toBe(false);
    expect(isExplanationOpen(store.getState(), "b")).toBe(true);

    // Pressing the pane button while the active question is overridden closed reopens all.
    expect(store.getState().toggleAll("a")).toBe(true);
    expect(store.getState().allOpen).toBe(true);
    expect(isExplanationOpen(store.getState(), "a")).toBe(true);
    expect(isExplanationOpen(store.getState(), "b")).toBe(true);

    // Pressing the pane button again when all are open closes every explanation.
    expect(store.getState().toggleAll("a")).toBe(false);
    expect(store.getState().allOpen).toBe(false);
    expect(isExplanationOpen(store.getState(), "a")).toBe(false);
    expect(isExplanationOpen(store.getState(), "b")).toBe(false);
  });

  it("reopens an individually closed question and toggles cleanly with no active key", () => {
    const store = createExplainedStore();

    expect(store.getState().toggleAll(null)).toBe(true);
    expect(store.getState().toggle("a")).toBe(false);
    expect(store.getState().toggle("a")).toBe(true);
    expect(isExplanationOpen(store.getState(), "a")).toBe(true);
    expect(store.getState().toggleAll(null)).toBe(false);
    expect(isExplanationOpen(store.getState(), "a")).toBe(false);
  });

  it("gives each review its own explanations", () => {
    const first = createExplainedStore();
    first.getState().toggle("a");

    const second = createExplainedStore();
    expect(second.getState().allOpen).toBe(false);
    expect(HashSet.size(second.getState().overrides)).toBe(0);
  });
});
