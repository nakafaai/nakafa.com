import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createSittingStore } from "@/components/exams/sitting/store";

const attemptId = Schema.decodeUnknownSync(Id("examAttempts"));

describe("createSittingStore", () => {
  it("starts with every seat and no seat warmed", () => {
    const state = createSittingStore().getState();

    expect(state.filter).toBe("all");
    expect(state.onSeat).toBeNull();
  });

  it("changes the filter and keeps the warmed seat", () => {
    const store = createSittingStore();
    const seat = { attemptId: attemptId("attempt-a"), cursor: null };
    store.getState().warm(seat);

    store.getState().chooseFilter("needsAttention");

    expect(store.getState().filter).toBe("needsAttention");
    expect(store.getState().onSeat).toEqual(seat);
  });

  it("gives every dashboard instance its own state", () => {
    const first = createSittingStore();
    const second = createSittingStore();

    first.getState().chooseFilter("finished");

    expect(second.getState().filter).toBe("all");
  });

  it("warms the seat the reader is on", () => {
    const store = createSittingStore();
    const seat = { attemptId: attemptId("attempt-a"), cursor: null };

    store.getState().warm(seat);

    expect(store.getState().onSeat).toEqual(seat);
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
