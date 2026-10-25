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

    store
      .getState()
      .choose({ attemptId: attemptId("attempt-a"), cursor: "page-2" });
    expect(store.getState().selected).toEqual({
      attemptId: attemptId("attempt-a"),
      cursor: "page-2",
    });

    store.getState().choose(null);
    expect(store.getState().selected).toBeNull();
  });

  it("changes the filter and keeps the selection", () => {
    const store = createSittingStore();
    store
      .getState()
      .choose({ attemptId: attemptId("attempt-a"), cursor: null });

    store.getState().chooseFilter("needsAttention");

    expect(store.getState().filter).toBe("needsAttention");
    expect(store.getState().selected).toEqual({
      attemptId: attemptId("attempt-a"),
      cursor: null,
    });
  });

  it("gives every dashboard instance its own state", () => {
    const first = createSittingStore();
    const second = createSittingStore();

    first.getState().chooseFilter("finished");

    expect(second.getState().filter).toBe("all");
  });

  it("warms the seat the reader is on without choosing it", () => {
    const store = createSittingStore();
    const seat = { attemptId: attemptId("attempt-a"), cursor: null };

    store.getState().warm(seat);

    expect(store.getState().onSeat).toEqual(seat);
    expect(store.getState().selected).toBeNull();
  });

  it("keeps the state when the reader is still on the warmed seat", () => {
    const store = createSittingStore();
    store
      .getState()
      .warm({ attemptId: attemptId("attempt-a"), cursor: "page-2" });
    const before = store.getState();

    store
      .getState()
      .warm({ attemptId: attemptId("attempt-a"), cursor: "page-2" });

    expect(store.getState()).toBe(before);
  });

  it("moves the warmed seat to the seat the reader reaches next", () => {
    const store = createSittingStore();
    store.getState().warm({ attemptId: attemptId("attempt-a"), cursor: null });

    store.getState().warm({ attemptId: attemptId("attempt-b"), cursor: null });

    expect(store.getState().onSeat).toEqual({
      attemptId: attemptId("attempt-b"),
      cursor: null,
    });
  });
});
