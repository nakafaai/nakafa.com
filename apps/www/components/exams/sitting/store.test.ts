import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createSittingStore } from "@/components/exams/sitting/store";

const attemptId = Schema.decodeUnknownSync(Id("examAttempts"));

describe("createSittingStore", () => {
  it("starts with every seat and no selection", () => {
    const state = createSittingStore().getState();

    expect(state.filter).toBe("all");
    expect(state.selected).toBeNull();
  });

  it("keeps the selected seat until another is chosen or the selection is cleared", () => {
    const store = createSittingStore();

    store.getState().choose(attemptId("attempt-a"));
    expect(store.getState().selected).toBe(attemptId("attempt-a"));

    store.getState().choose(null);
    expect(store.getState().selected).toBeNull();
  });

  it("changes the filter and keeps the selection", () => {
    const store = createSittingStore();
    store.getState().choose(attemptId("attempt-a"));

    store.getState().chooseFilter("needsAttention");

    expect(store.getState().filter).toBe("needsAttention");
    expect(store.getState().selected).toBe(attemptId("attempt-a"));
  });

  it("gives every dashboard instance its own state", () => {
    const first = createSittingStore();
    const second = createSittingStore();

    first.getState().chooseFilter("finished");

    expect(second.getState().filter).toBe("all");
  });
});
