import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { emptyDraft } from "@/components/tenant/exams/figure/draft";
import { createFigureBuilder } from "@/components/tenant/exams/figure/store";

/** A builder over a named, described graph, which starts with one function. */
const builder = () =>
  createFigureBuilder({
    ...emptyDraft("graph"),
    alt: "Parabola",
    title: "Grafik",
  });

describe("exams/figure/store", () => {
  it("draws the figure it opens on, and keeps the last figure while a value is on its way", () => {
    const store = builder();
    expect(Option.isSome(store.getState().figure)).toBe(true);
    const drawn = store.getState().shown;
    store.getState().changeShape("function-1", { to: "" });
    expect(Option.isNone(store.getState().figure)).toBe(true);
    expect(store.getState().shown).toBe(drawn);
    store.getState().changeShape("function-1", { to: "3" });
    expect(Option.isSome(store.getState().figure)).toBe(true);
    expect(store.getState().shown).toBe(store.getState().figure);
  });

  it("adds, copies and removes objects under free ids, and changes only the one it names", () => {
    const store = builder();
    store.getState().addShape("point");
    store.getState().addShape("point");
    store.getState().copyShape("point-1");
    expect(Arr.map(store.getState().draft.shapes, ({ id }) => id)).toEqual([
      "function-1",
      "point-1",
      "point-3",
      "point-2",
    ]);
    store.getState().changeShape("point-2", { x: "4" });
    expect(
      Arr.map(store.getState().draft.shapes, ({ x }) => x)
    ).toEqual(["0", "0", "0", "4"]);
    store.getState().removeShape("point-1");
    store.getState().addShape("point");
    expect(Arr.map(store.getState().draft.shapes, ({ id }) => id)).toEqual([
      "function-1",
      "point-3",
      "point-2",
      "point-1",
    ]);
  });

  it("adds sliders on free letters until every letter is taken, and changes and removes them", () => {
    const store = builder();
    for (const _ of Arr.range(1, 17)) {
      store.getState().addSlider();
    }
    expect(store.getState().draft.sliders).toHaveLength(16);
    store.getState().changeSlider("a", { value: "2" });
    expect(store.getState().draft.sliders[0]?.value).toBe("2");
    store.getState().removeSlider("a");
    expect(store.getState().draft.sliders[0]?.name).toBe("b");
    store.getState().change({ title: "Bidang" });
    expect(store.getState().draft.title).toBe("Bidang");
  });
});
