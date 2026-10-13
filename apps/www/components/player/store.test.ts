import { describe, expect, it } from "@effect/vitest";
import { createPlayerStore } from "@/components/player/store";

/** A player of three questions in the list view. */
function listOfThree() {
  return createPlayerStore({ keys: ["a", "b", "c"], mode: "list" });
}

describe("player store", () => {
  it("starts on the first question in the view the server resolved", () => {
    expect(
      createPlayerStore({ keys: ["a", "b"], mode: "single" }).getState()
    ).toMatchObject({
      current: "a",
      jump: null,
      mode: "single",
      overlay: "none",
      pending: null,
      pinned: false,
    });
  });

  it("has no current question without questions", () => {
    const store = createPlayerStore({ keys: [], mode: "list" });

    store.getState().step(1);
    store.getState().setMode("single");

    expect(store.getState()).toMatchObject({
      current: null,
      jump: null,
      mode: "single",
    });
  });

  it("goes to a question and reveals it each time it is asked for", () => {
    const store = listOfThree();

    store.getState().goTo("c");
    expect(store.getState()).toMatchObject({
      current: "c",
      jump: { key: "c", seq: 1 },
      pinned: true,
    });

    store.getState().goTo("c");
    expect(store.getState().jump).toEqual({ key: "c", seq: 2 });
  });

  it("steps within the frozen order and stops at both ends", () => {
    const store = listOfThree();

    store.getState().step(-1);
    expect(store.getState().current).toBe("a");
    expect(store.getState().jump).toBeNull();

    store.getState().step(1);
    store.getState().step(1);
    expect(store.getState()).toMatchObject({
      current: "c",
      jump: { key: "c", seq: 2 },
    });

    store.getState().step(1);
    expect(store.getState().jump).toEqual({ key: "c", seq: 2 });

    store.getState().step(-1);
    expect(store.getState().current).toBe("b");
  });

  it("waits for an open overlay to finish closing before it reveals", () => {
    const store = listOfThree();
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
  });

  it("opens one overlay in place of another and closes it", () => {
    const store = listOfThree();

    store.getState().open("navigator");
    store.getState().open("finish");
    expect(store.getState().overlay).toBe("finish");

    store.getState().close();
    expect(store.getState().overlay).toBe("none");
  });

  it("follows the reading line until a jump or a focus holds the question", () => {
    const store = listOfThree();

    store.getState().observe("b");
    expect(store.getState()).toMatchObject({ current: "b", observed: null });

    store.getState().goTo("c");
    store.getState().observe("b");
    expect(store.getState()).toMatchObject({ current: "c", observed: "b" });

    store.getState().release();
    expect(store.getState()).toMatchObject({
      current: "b",
      observed: null,
      pinned: false,
    });
  });

  it("keeps the held question when the learner scrolls before anything is observed", () => {
    const store = listOfThree();
    store.getState().focus("c");

    store.getState().release();

    expect(store.getState()).toMatchObject({ current: "c", pinned: false });
  });

  it("ignores a scroll while nothing is held", () => {
    const store = listOfThree();
    store.getState().observe("b");
    const changed = vi.fn();
    store.subscribe(changed);

    store.getState().release();

    expect(changed).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ current: "b", pinned: false });
  });

  it("holds the question that has the learner's focus", () => {
    const store = listOfThree();
    store.getState().observe("b");

    store.getState().focus("a");
    store.getState().observe("c");

    expect(store.getState()).toMatchObject({
      current: "a",
      observed: "c",
      pinned: true,
    });
  });

  it("shows the other view and reveals the current question in it", () => {
    const store = listOfThree();
    store.getState().goTo("b");

    store.getState().setMode("single");

    expect(store.getState()).toMatchObject({
      current: "b",
      jump: { key: "b", seq: 2 },
      mode: "single",
      pinned: true,
    });
  });
});
