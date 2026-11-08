import { describe, expect, it } from "@effect/vitest";
import { HashMap, Option } from "effect";
import { createLines } from "@/components/player/lines/store";

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

  it("registers each dot and column, forgets one as it leaves, and keeps the element that took its place", () => {
    const store = createLines();
    const first = document.createElement("button");
    const second = document.createElement("button");
    const list = document.createElement("ol");
    store.getState().anchor("source-1", first);
    store.getState().frame("sources", list);
    expect(HashMap.get(store.getState().anchors, "source-1")).toEqual(
      Option.some(first)
    );
    expect(HashMap.get(store.getState().columns, "sources")).toEqual(
      Option.some(list)
    );
    // A remount registers its new dot before the old one leaves, so the old one's leave forgets nothing.
    store.getState().anchor("source-1", second);
    store.getState().unanchor("source-1", first);
    expect(
      Option.exists(
        HashMap.get(store.getState().anchors, "source-1"),
        (dot) => dot === second
      )
    ).toBe(true);
    store.getState().unanchor("source-1", second);
    store.getState().unframe("sources", list);
    expect(HashMap.size(store.getState().anchors)).toBe(0);
    expect(HashMap.size(store.getState().columns)).toBe(0);
    // A column that another list took over keeps that list when the first one leaves.
    store.getState().frame("targets", list);
    store.getState().unframe("targets", document.createElement("ol"));
    expect(HashMap.size(store.getState().columns)).toBe(1);
  });
});
