import { describe, expect, it } from "@effect/vitest";
import { Option, Result } from "effect";
import { emptyDraft, figureOf } from "@/components/tenant/exams/figure/form";
import type { GraphDraft } from "@/components/tenant/exams/figure/graph/draft";
import {
  emptyGraph,
  figureDraftOf,
  graphOf,
  previewOf,
  propsOf,
} from "@/components/tenant/exams/figure/graph/draft";

/** A graph a teacher has named and described. */
const graph: GraphDraft = {
  ...emptyGraph(),
  alt: "Garis naik",
  title: "Grafik",
};

/** The props a graph makes, which the test expects to exist. */
const made = (draft: GraphDraft) => Option.getOrThrow(propsOf(draft));

describe("exams/figure/graph/draft", () => {
  it("makes the props of a MathVisual from its plane: one function by default, fitted with the origin, under its name", () => {
    const { description, scene, title } = made(graph);
    if (scene.space !== "plane") {
      throw new Error("A new graph is a plane.");
    }
    expect(scene.objects).toEqual([
      {
        appearance: "primary",
        domain: { max: 2, min: -2 },
        formula: "x^2",
        id: "function-1",
        kind: "function",
      },
    ]);
    expect(scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 3, min: -3 },
      y: { max: 5, min: -1 },
    });
    expect(title).toEqual([{ text: "Grafik", type: "text" }]);
    expect(description).toEqual([{ text: "Garis naik", type: "text" }]);
  });

  it("makes no props for a word in place of a number, a formula that does not read, or an empty plane", () => {
    const [curve] = graph.shapes;
    expect(
      Option.isNone(propsOf({ ...graph, shapes: [{ ...curve, from: "dua" }] }))
    ).toBe(true);
    expect(
      Option.isNone(
        propsOf({ ...graph, shapes: [{ ...curve, formula: "x +" }] })
      )
    ).toBe(true);
    expect(Option.isNone(propsOf({ ...graph, shapes: [] }))).toBe(true);
  });

  it("previews a graph with no name or description yet, which the catalog refuses to save, and keeps the words the teacher wrote", () => {
    const unnamed = emptyGraph();
    expect(Option.isNone(propsOf(unnamed))).toBe(true);
    const preview = Option.getOrThrow(previewOf(unnamed));
    expect(preview.component).toBe("MathVisual");
    expect(Result.isFailure(figureOf(figureDraftOf(unnamed, "")))).toBe(true);
    expect(Option.getOrThrow(previewOf(graph)).alt).toBe("Garis naik");
    expect(Option.isNone(previewOf({ ...graph, shapes: [] }))).toBe(true);
  });

  it("writes a graph as a catalog draft the catalog accepts, keeping its caption, and one it refuses while the graph is unready", () => {
    const draft = figureDraftOf(graph, "Gambar 1");
    expect(draft).toMatchObject({
      alt: "Garis naik",
      caption: "Gambar 1",
      component: "MathVisual",
    });
    expect(Result.isSuccess(figureOf(draft))).toBe(true);
    const unready = figureDraftOf({ ...graph, shapes: [] }, "");
    expect(unready.props).toBeNull();
    expect(Result.isFailure(figureOf(unready))).toBe(true);
  });

  it("reads a catalog draft back into the graph that made it, so a teacher edits what stands there", () => {
    const manual: GraphDraft = {
      ...graph,
      view: "manual",
      xMax: "3",
      xMin: "-3",
      yMax: "5",
      yMin: "-1",
    };
    expect(Option.getOrThrow(graphOf(figureDraftOf(manual, "")))).toEqual(
      manual
    );
  });

  it("reads the words of a title that holds math, which a field cannot show", () => {
    const draft = figureDraftOf(graph, "");
    const titled = {
      ...draft,
      props: {
        ...made(graph),
        title: [
          { text: "Grafik ", type: "text" },
          { attrs: { latex: "y = x" }, type: "mathInline" },
        ],
      },
    };
    expect(Option.getOrThrow(graphOf(titled)).title).toBe("Grafik ");
  });

  it("offers no graph for another visual, props its schema refuses, or a scene the builder cannot write", () => {
    expect(Option.isNone(graphOf(emptyDraft("Chart")))).toBe(true);
    expect(
      Option.isNone(graphOf({ ...figureDraftOf(graph, ""), props: {} }))
    ).toBe(true);
    const props = made(graph);
    if (props.scene.space !== "plane") {
      throw new Error("A new graph is a plane.");
    }
    const curve = {
      ...figureDraftOf(graph, ""),
      props: {
        ...props,
        scene: {
          ...props.scene,
          objects: [
            {
              appearance: "primary",
              id: "loop",
              kind: "parametric",
              parameter: { max: 1, min: 0 },
              x: "t",
              y: "t",
            },
          ],
        },
      },
    };
    expect(Option.isNone(graphOf(curve))).toBe(true);
  });
});
