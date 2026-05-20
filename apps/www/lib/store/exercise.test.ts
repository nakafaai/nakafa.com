import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExerciseStore } from "@/lib/store/exercise";

describe("createExerciseStore", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates exercise UI state", () => {
    const store = createExerciseStore({ slug: "algebra" });

    store.getState().toggleAnswer(2);
    store.getState().setTimeSpent(2, 45);
    store.getState().setShowStats(false);

    expect(store.getState().visibleExplanations[2]).toBe(true);
    expect(store.getState().timeSpent[2]).toBe(45);
    expect(store.getState().showStats).toBe(false);

    store.getState().resetTimeSpent();

    expect(store.getState().timeSpent).toEqual({});
  });

  it("restores valid migrated state", () => {
    sessionStorage.setItem(
      "nakafa-exercise-geometry",
      JSON.stringify({
        state: {
          showStats: false,
          slug: "geometry",
          timeSpent: { 1: 30 },
          visibleExplanations: { 1: true },
        },
        version: 2,
      })
    );

    const store = createExerciseStore({ slug: "geometry" });

    expect(store.getState().slug).toBe("geometry");
    expect(store.getState().showStats).toBe(false);
    expect(store.getState().timeSpent[1]).toBe(30);
    expect(store.getState().visibleExplanations[1]).toBe(true);
  });

  it("falls back when migrated state is invalid", () => {
    sessionStorage.setItem(
      "nakafa-exercise-statistics",
      JSON.stringify({
        state: {
          showStats: false,
          slug: "",
          timeSpent: {},
          visibleExplanations: {},
        },
        version: 2,
      })
    );

    const store = createExerciseStore({ slug: "statistics" });

    expect(store.getState().slug).toBe("statistics");
    expect(store.getState().showStats).toBe(true);
  });

  it("falls back when migrated state cannot be decoded", () => {
    sessionStorage.setItem(
      "nakafa-exercise-calculus",
      JSON.stringify({
        state: { slug: "calculus" },
        version: 2,
      })
    );

    const store = createExerciseStore({ slug: "calculus" });

    expect(store.getState().showStats).toBe(true);
    expect(store.getState().timeSpent).toEqual({});
    expect(store.getState().visibleExplanations).toEqual({});
  });
});

function createStorage() {
  const items = new Map<string, string>();

  return {
    clear: vi.fn(() => items.clear()),
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    key: vi.fn((index: number) => [...items.keys()][index] ?? null),
    get length() {
      return items.size;
    },
    removeItem: vi.fn((key: string) => items.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, value);
    }),
  };
}
