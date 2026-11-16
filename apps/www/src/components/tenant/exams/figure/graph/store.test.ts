import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableRef, Option } from "effect";
import {
  emptyGraph,
  type GraphDraft,
} from "@/components/tenant/exams/figure/graph/draft";
import { createGraphStore } from "@/components/tenant/exams/figure/graph/store";

/** A builder over a named, described graph, which starts with one function, and the graphs it wrote. */
const builder = () => {
  const written = MutableRef.make<readonly GraphDraft[]>([]);
  const store = createGraphStore(
    { ...emptyGraph(), alt: "Parabola", title: "Grafik" },
    (draft) => MutableRef.update(written, Arr.append(draft))
  );
  return Object.assign(store, { written });
};

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
    expect(store.getState().shown).toEqual(store.getState().figure);
    // The dialog hears of every graph, the one a value on its way left unready included.
    const written = MutableRef.get(store.written);
    expect(written).toHaveLength(2);
    expect(written[1]).toBe(store.getState().draft);
  });

  it("draws a graph before the teacher names or describes it, and saves it only once both are written", () => {
    const store = createGraphStore(emptyGraph(), () => undefined);
    expect(Option.isSome(store.getState().shown)).toBe(true);
    expect(Option.isNone(store.getState().figure)).toBe(true);
    store.getState().change({ alt: "Parabola", title: "Grafik" });
    expect(Option.isSome(store.getState().figure)).toBe(true);
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
    expect(Arr.map(store.getState().draft.shapes, ({ x }) => x)).toEqual([
      "0",
      "0",
      "0",
      "4",
    ]);
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
