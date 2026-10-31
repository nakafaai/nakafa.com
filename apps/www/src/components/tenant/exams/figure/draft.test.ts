import { describe, expect, it } from "@effect/vitest";
import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
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
  it("makes a line through the ends of its range, in a frame that holds it and both axes", () => {
    const figure = made({ ...graph, a: "2", b: "1", from: "1", to: "3" });
    if (figure.component !== "MathVisual") {
      throw new Error("A graph is a math visual.");
    }
    expect(figure.props.scene.objects[0]).toMatchObject({
      kind: "line",
      through: [
        { x: 1, y: 3 },
        { x: 3, y: 7 },
      ],
    });
    expect(figure.props.scene.frame).toMatchObject({
      x: { max: 4, min: -1 },
      y: { max: 8, min: -1 },
    });
  });

  it("frames a parabola around its turning point when that falls in its range, and reads a decimal comma", () => {
    const inside = made({
      ...graph,
      a: "1",
      b: "0",
      c: "-4,5",
      curve: "quadratic",
    });
    if (inside.component !== "MathVisual") {
      throw new Error("A graph is a math visual.");
    }
    expect(inside.props.scene.frame).toMatchObject({
      y: { max: 21.5, min: -5.5 },
    });
    const beside = made({
      ...graph,
      a: "1",
      curve: "quadratic",
      from: "1",
      to: "2",
    });
    if (beside.component !== "MathVisual") {
      throw new Error("A graph is a math visual.");
    }
    expect(beside.props.scene.frame).toMatchObject({ y: { max: 5, min: -1 } });
  });

  it("refuses a graph with no name, a word for a number, and a range that runs backwards", () => {
    expect(Option.isNone(figureOf({ ...graph, title: "" }))).toBe(true);
    expect(Option.isNone(figureOf({ ...graph, a: "dua" }))).toBe(true);
    expect(Option.isNone(figureOf({ ...graph, from: "5", to: "1" }))).toBe(
      true
    );
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
      { ...graph, a: "2", b: "1", from: "1", to: "3" },
      { ...graph, a: "2", b: "3", c: "1", curve: "quadratic" },
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

  it("offers no draft for a figure a teacher cannot make here, and keeps a graph it cannot read as it stands", () => {
    const circle: FigureAttrs = {
      alt: "Lingkaran",
      caption: null,
      component: "UnitCircle",
      props: {
        description: [{ text: "Lingkaran", type: "text" }],
        title: [{ text: "Lingkaran", type: "text" }],
      },
    };
    expect(Option.isNone(draftOf(circle))).toBe(true);
    const line = made(graph);
    if (line.component !== "MathVisual") {
      throw new Error("A graph is a math visual.");
    }
    const point = {
      ...line,
      props: {
        ...line.props,
        scene: {
          ...line.props.scene,
          objects: [
            {
              appearance: "primary",
              at: { x: 0, y: 0 },
              id: "dot",
              kind: "point",
            },
          ],
        },
      },
    } as const;
    expect(Option.getOrThrow(draftOf(point))).toMatchObject({
      kind: "graph",
      title: "Grafik",
    });
  });
});
