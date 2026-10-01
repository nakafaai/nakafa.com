import { describe, expect, it } from "@effect/vitest";
import { createPlayerStore } from "@/components/player/store";

function makeStore(keys: readonly string[] = ["a", "b", "c"]) {
  return createPlayerStore({ keys, mode: "list" });
}

describe("player view store", () => {
  it("starts on the first question with no overlay or jump", () => {
    expect(makeStore().getState()).toMatchObject({
      current: "a",
      jump: null,
      mode: "list",
      overlay: "none",
      pinned: false,
    });
    expect(makeStore([]).getState().current).toBeNull();
  });

  it("jumps at once and steps within the frozen order", () => {
    const store = makeStore();
    store.getState().goTo("c");
    expect(store.getState()).toMatchObject({
      current: "c",
      jump: { key: "c", seq: 1 },
      pinned: true,
    });
    store.getState().step(1);
    expect(store.getState().jump).toEqual({ key: "c", seq: 1 });
    store.getState().step(-1);
    expect(store.getState()).toMatchObject({
      current: "b",
      jump: { key: "b", seq: 2 },
    });
    makeStore([]).getState().step(1);
  });

  it("waits for an open overlay to close before revealing", () => {
    const store = makeStore();
    store.getState().open("navigator");
    store.getState().goTo("b");
    expect(store.getState()).toMatchObject({
      current: "b",
      jump: null,
      overlay: "none",
      pending: "b",
    });
    store.getState().settle();
    expect(store.getState()).toMatchObject({
      jump: { key: "b", seq: 1 },
      pending: null,
    });
    store.getState().settle();
    expect(store.getState().jump).toEqual({ key: "b", seq: 1 });
    store.getState().open("finish");
    store.getState().close();
    expect(store.getState().overlay).toBe("none");
  });

  it("keeps a jump current until the reader scrolls", () => {
    const store = makeStore();
    store.getState().observe("b");
    expect(store.getState().current).toBe("b");
    store.getState().goTo("c");
    store.getState().observe("b");
    expect(store.getState()).toMatchObject({ current: "c", observed: "b" });
    store.getState().release();
    expect(store.getState()).toMatchObject({
      current: "b",
      observed: null,
      pinned: false,
    });
    store.getState().release();
    store.getState().focus("a");
    store.getState().release();
    expect(store.getState()).toMatchObject({ current: "a", pinned: false });
  });

  it("switches mode and reveals the current question", () => {
    const store = makeStore();
    store.getState().goTo("b");
    store.getState().setMode("single");
    expect(store.getState()).toMatchObject({
      jump: { key: "b", seq: 2 },
      mode: "single",
    });
    const empty = makeStore([]);
    empty.getState().setMode("single");
    expect(empty.getState()).toMatchObject({ jump: null, mode: "single" });
  });
});
