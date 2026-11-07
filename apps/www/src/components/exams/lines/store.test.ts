import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { createLines } from "@/components/exams/lines/store";

describe("createLines", () => {
  it("takes a statement in hand, moves the hand to another, and puts it down on a second press", () => {
    const store = createLines();
    store.getState().take("source-1");
    expect(store.getState().held).toEqual(Option.some("source-1"));
    store.getState().take("source-2");
    expect(store.getState().held).toEqual(Option.some("source-2"));
    store.getState().take("source-2");
    expect(store.getState().held).toEqual(Option.none());
  });

  it("pulls a statement's line over an answer, and remembers the line a release drew", () => {
    const store = createLines();
    store
      .getState()
      .pull("source-1", { x: 40, y: 12 }, Option.some("target-2"));
    expect(store.getState()).toMatchObject({
      held: Option.some("source-1"),
      over: Option.some("target-2"),
      tip: Option.some({ x: 40, y: 12 }),
    });
    store.getState().release(Option.some("source-1"));
    expect(store.getState()).toMatchObject({
      drawn: Option.some("source-1"),
      held: Option.none(),
      over: Option.none(),
      tip: Option.none(),
    });
    // The next press draws again, so a line it makes grows.
    store.getState().take("source-2");
    expect(store.getState().drawn).toEqual(Option.none());
  });

  it("keeps the measure it holds while no dot moved, and takes a new one when one did", () => {
    const store = createLines();
    store.getState().place({ "source-1": { x: 10, y: 20 } });
    const first = store.getState().points;
    store.getState().place({ "source-1": { x: 10, y: 20 } });
    expect(store.getState().points).toBe(first);
    store.getState().place({ "source-1": { x: 10, y: 24 } });
    expect(store.getState().points).toEqual({ "source-1": { x: 10, y: 24 } });
  });

  it("points at one line, and at none", () => {
    const store = createLines();
    store.getState().light(Option.some("source-3"));
    expect(store.getState().lit).toEqual(Option.some("source-3"));
    store.getState().light(Option.none());
    expect(store.getState().lit).toEqual(Option.none());
  });
});
