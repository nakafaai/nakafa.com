import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  draftOf,
  emptyDraft,
  type FigureDraft,
  figureOf,
} from "@/components/tenant/exams/figure/draft";

/** A graph a teacher has named and described. */
const graph: FigureDraft = {
  ...emptyDraft("graph"),
  alt: "Garis naik",
  title: "Grafik",
};

/** The figure a draft makes, which the test expects to exist. */
const made = (draft: FigureDraft) => Option.getOrThrow(figureOf(draft));

describe("exams/figure", () => {
  it("makes a graph of its plane: one function by default, fitted with the origin, under its name", () => {
    const figure = made(graph);
    if (
      figure.component !== "MathVisual" ||
      figure.props.scene.space !== "plane"
    ) {
      throw new Error("A graph is a math visual on a plane.");
    }
    expect(figure.props.scene.objects).toEqual([
      {
        appearance: "primary",
        domain: { max: 2, min: -2 },
        formula: "x^2",
        id: "function-1",
        kind: "function",
      },
    ]);
    expect(figure.props.scene.frame).toEqual({
      kind: "cartesian",
      x: { max: 3, min: -3 },
      y: { max: 5, min: -1 },
    });
    expect(figure.props.title).toEqual([{ text: "Grafik", type: "text" }]);
  });

  it("refuses a graph with no name, a word for a number, a formula that does not read, and an empty plane", () => {
    const [curve] = graph.shapes;
    expect(Option.isNone(figureOf({ ...graph, title: "" }))).toBe(true);
    expect(
      Option.isNone(figureOf({ ...graph, shapes: [{ ...curve, from: "dua" }] }))
    ).toBe(true);
    expect(
      Option.isNone(
        figureOf({ ...graph, shapes: [{ ...curve, formula: "x +" }] })
      )
    ).toBe(true);
    expect(Option.isNone(figureOf({ ...graph, shapes: [] }))).toBe(true);
  });

  it("makes a chart of bars or of a line, and refuses values that do not match its labels", () => {
    const draft: FigureDraft = {
      ...emptyDraft("chart"),
      alt: "Nilai tiap kelas",
      categories: "X, XI, XII",
      title: "Nilai",
      values: "70 80,5 90",
    };
    const bars = made(draft);
    if (bars.component !== "Chart") {
      throw new Error("A chart is a chart.");
    }
    expect(bars.props.bars).toBe("apart");
    expect(bars.props.series[0]).toMatchObject({ values: [70, 80.5, 90] });
    const line = made({ ...draft, mark: "line" });
    if (line.component !== "Chart") {
      throw new Error("A chart is a chart.");
    }
    expect(line.props.bars).toBeUndefined();
    expect(Option.isNone(figureOf({ ...draft, values: "70 80" }))).toBe(true);
    expect(Option.isNone(figureOf({ ...draft, values: "70 x 90" }))).toBe(true);
  });

  it("makes a diagram of Mermaid source, and refuses one with no source", () => {
    const draft: FigureDraft = {
      ...emptyDraft("diagram"),
      alt: "Alur air",
      chart: "graph TD; A-->B",
      title: "Alur",
    };
    expect(made(draft).component).toBe("Mermaid");
    expect(Option.isNone(figureOf({ ...draft, chart: "" }))).toBe(true);
  });

  it("reads a figure back into the draft that made it, so a teacher edits what stands there", () => {
    const drafts: readonly FigureDraft[] = [
      {
        ...graph,
        view: "manual",
        xMax: "3",
        xMin: "-3",
        yMax: "5",
        yMin: "-1",
      },
      {
        ...emptyDraft("chart"),
        alt: "Nilai",
        categories: "X, XI",
        title: "Nilai",
        values: "70 80",
      },
      {
        ...emptyDraft("diagram"),
        alt: "Alur",
        chart: "graph TD; A-->B",
        title: "Alur",
      },
    ];
    for (const draft of drafts) {
      expect(Option.getOrThrow(draftOf(made(draft)))).toEqual(draft);
    }
  });

  it("reads the words of a title that holds math, which a field cannot show", () => {
    const line = made(graph);
    if (line.component !== "MathVisual") {
      throw new Error("A graph is a math visual.");
    }
    const titled = {
      ...line,
      props: {
        ...line.props,
        title: [
          { text: "Grafik ", type: "text" },
          { attrs: { latex: "y = x" }, type: "mathInline" },
        ],
      },
    } as const;
    expect(Option.getOrThrow(draftOf(titled)).title).toBe("Grafik ");
  });

  it("offers no draft for a scene the builder cannot write, and keeps it as it stands", () => {
    const line = made(graph);
    if (line.component !== "MathVisual" || line.props.scene.space !== "plane") {
      throw new Error("A graph is a math visual on a plane.");
    }
    const curve = {
      ...line,
      props: {
        ...line.props,
        scene: {
          ...line.props.scene,
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
    } as const;
    expect(Option.isNone(draftOf(curve))).toBe(true);
  });
});
