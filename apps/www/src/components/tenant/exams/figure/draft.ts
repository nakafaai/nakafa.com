import {
  type FigureAttrs,
  FigureAttrsSchema,
} from "@nakafa/aksara-contracts/assessment/figure";
import type { InlineNode } from "@nakafa/aksara-contracts/assessment/inline";
import {
  Array as Arr,
  Match,
  Option,
  pipe,
  Schema,
  String as Str,
} from "effect";

/** The figures a teacher makes: a graph of a function, a chart of values, or a diagram. */
export const FigureKind = Schema.Literals(["graph", "chart", "diagram"]);
export type FigureKind = typeof FigureKind.Type;

/** The curves a graph draws: y = ax + b, or y = ax² + bx + c. */
export const GraphCurve = Schema.Literals(["line", "quadratic"]);
export type GraphCurve = typeof GraphCurve.Type;

/** How a chart draws its values. */
export const ChartMark = Schema.Literals(["bar", "line"]);
export type ChartMark = typeof ChartMark.Type;

/**
 * What a teacher writes for a figure, as the fields hold it: every number as typed, so a value on its way never
 * jumps. Each kind reads its own fields and leaves the others as they stand.
 */
export const FigureDraft = Schema.Struct({
  a: Schema.String,
  alt: Schema.String,
  b: Schema.String,
  c: Schema.String,
  categories: Schema.String,
  chart: Schema.String,
  curve: GraphCurve,
  from: Schema.String,
  kind: FigureKind,
  mark: ChartMark,
  title: Schema.String,
  to: Schema.String,
  values: Schema.String,
});
export type FigureDraft = typeof FigureDraft.Type;

/** A new figure of a kind, with a graph's axis laid out from minus five to five. */
export const emptyDraft = (kind: FigureKind): FigureDraft => ({
  a: "1",
  alt: "",
  b: "0",
  c: "0",
  categories: "",
  chart: "",
  curve: "line",
  from: "-5",
  kind,
  mark: "bar",
  title: "",
  to: "5",
  values: "",
});

/** The room around a curve in its frame, so nothing touches the edge of the graph. */
const GRAPH_MARGIN = 1;

/** The one curve of a graph, which the scene names. */
const CURVE_ID = "curve";

/** Rich text of one line of plain words, as a figure's title and description hold it. */
const richText = (text: string) => [{ text, type: "text" }];

/** The number a teacher typed, with either decimal point, or none when it is no number. */
const numberOf = (text: string) =>
  Schema.decodeUnknownOption(Schema.FiniteFromString)(
    pipe(text, Str.trim, Str.replace(",", "."))
  );

/** The words of a comma-separated list, each trimmed, without empty ones. */
const wordsOf = (text: string) =>
  pipe(Str.split(text, ","), Arr.map(Str.trim), Arr.filter(Str.isNonEmpty));

/** What parts the numbers of a list. */
const NUMBER_GAP = /[;\s]+/u;

/** The numbers of a list split on semicolons or spaces, or none when one of them is no number. */
const numbersOf = (text: string) =>
  pipe(
    Str.split(text, NUMBER_GAP),
    Arr.filter(Str.isNonEmpty),
    Arr.map(numberOf),
    Option.all
  );

/** The frame around a curve: its own range with a margin, and always the origin, so both axes show. */
const frameAround = (
  from: number,
  to: number,
  values: readonly [number, ...number[]]
) => ({
  kind: "cartesian",
  x: {
    max: Math.max(to, 0) + GRAPH_MARGIN,
    min: Math.min(from, 0) - GRAPH_MARGIN,
  },
  y: {
    max: Math.max(...values, 0) + GRAPH_MARGIN,
    min: Math.min(...values, 0) - GRAPH_MARGIN,
  },
});

/** The scene of a line y = ax + b from `from` to `to`. */
const lineScene = (a: number, b: number, from: number, to: number) => {
  const start = { x: from, y: a * from + b };
  const end = { x: to, y: a * to + b };
  return {
    frame: frameAround(from, to, [start.y, end.y]),
    objects: [
      {
        appearance: "primary",
        id: CURVE_ID,
        kind: "line",
        through: [start, end],
      },
    ],
    space: "plane",
    view: { kind: "fit" },
  };
};

/**
 * The scene of a parabola y = ax² + bx + c from `from` to `to`. Its frame holds both ends and its turning point
 * when that falls in the range, so the whole curve stands inside the graph, computed from its formula.
 */
const quadraticScene = (
  coefficients: { readonly a: number; readonly b: number; readonly c: number },
  from: number,
  to: number
) => {
  const { a, b, c } = coefficients;
  const at = (x: number) => (a * x + b) * x + c;
  const turning = -b / (2 * a);
  return {
    frame: frameAround(
      from,
      to,
      turning > from && turning < to
        ? [at(from), at(to), at(turning)]
        : [at(from), at(to)]
    ),
    objects: [
      {
        appearance: "primary",
        coefficients,
        domain: { max: to, min: from },
        id: CURVE_ID,
        inputAxis: "x",
        kind: "quadratic",
      },
    ],
    space: "plane",
    view: { kind: "fit" },
  };
};

/** The scene of a draft's graph, or none while a number is missing or its range runs backwards. */
const sceneOf = (draft: FigureDraft) =>
  Option.map(
    Option.filter(
      Option.all({
        a: numberOf(draft.a),
        b: numberOf(draft.b),
        c: numberOf(draft.c),
        from: numberOf(draft.from),
        to: numberOf(draft.to),
      }),
      ({ from, to }) => from < to
    ),
    ({ a, b, c, from, to }) =>
      draft.curve === "line"
        ? lineScene(a, b, from, to)
        : quadraticScene({ a, b, c }, from, to)
  );

/** The component and the props of a draft, before the contract reads them. */
const propsOf = (draft: FigureDraft) => {
  const title = richText(draft.title);
  const description = richText(draft.alt);
  return Match.value(draft.kind).pipe(
    Match.when("graph", () =>
      Option.map(sceneOf(draft), (scene) => ({
        component: "MathVisual",
        props: { description, labels: {}, scene, title },
      }))
    ),
    Match.when("chart", () =>
      Option.map(numbersOf(draft.values), (values) => ({
        component: "Chart",
        props: {
          ...(draft.mark === "bar" ? { bars: "apart" } : {}),
          categories: wordsOf(draft.categories),
          description,
          series: [{ label: draft.title, mark: draft.mark, values }],
          title,
        },
      }))
    ),
    Match.when("diagram", () =>
      Option.some({
        component: "Mermaid",
        props: {
          chart: draft.chart,
          description: draft.alt,
          title: draft.title,
        },
      })
    ),
    Match.exhaustive
  );
};

/**
 * The figure a draft makes, or none while the contract refuses it: a name or a text alternative still empty, a
 * number that is no number, a range that runs backwards, or a chart whose values do not match its labels.
 */
export const figureOf = (draft: FigureDraft): Option.Option<FigureAttrs> =>
  Option.flatMap(propsOf(draft), (made) =>
    Schema.decodeUnknownOption(FigureAttrsSchema)({
      alt: draft.alt,
      caption: null,
      ...made,
    })
  );

/** The plain words of rich text, as a draft's fields hold them. */
const plainOf = (nodes: readonly InlineNode[]) =>
  Arr.join(
    Arr.map(nodes, (node) => (node.type === "text" ? node.text : "")),
    ""
  );

/** The numbers of a graph as its fields show them: `a` and `b` of a line read from its two ends. */
const graphFields = (
  attrs: Extract<FigureAttrs, { readonly component: "MathVisual" }>
): Partial<FigureDraft> => {
  const [object] = attrs.props.scene.objects;
  if (object.kind === "quadratic") {
    return {
      a: String(object.coefficients.a),
      b: String(object.coefficients.b),
      c: String(object.coefficients.c),
      curve: "quadratic",
      from: String(object.domain.min),
      to: String(object.domain.max),
    };
  }
  if (object.kind !== "line") {
    return {};
  }
  const [start, end] = object.through;
  const a = (end.y - start.y) / (end.x - start.x);
  return {
    a: String(a),
    b: String(start.y - a * start.x),
    curve: "line",
    from: String(start.x),
    to: String(end.x),
  };
};

/**
 * The draft of a figure already in a text, so the teacher edits what stands there. A figure of a component a
 * teacher cannot make here, as one a file brought in, has none, and its text stays as it is.
 */
export const draftOf = (attrs: FigureAttrs): Option.Option<FigureDraft> =>
  Match.value(attrs).pipe(
    Match.when({ component: "MathVisual" }, (graph) =>
      Option.some({
        ...emptyDraft("graph"),
        alt: attrs.alt,
        title: plainOf(graph.props.title),
        ...graphFields(graph),
      })
    ),
    Match.when({ component: "Chart" }, ({ props }) =>
      Option.some({
        ...emptyDraft("chart"),
        alt: attrs.alt,
        categories: Arr.join(props.categories, ", "),
        mark: Arr.headNonEmpty(props.series).mark,
        title: plainOf(props.title),
        values: Arr.join(
          Arr.map(Arr.headNonEmpty(props.series).values, String),
          " "
        ),
      })
    ),
    Match.when({ component: "Mermaid" }, ({ props }) =>
      Option.some({
        ...emptyDraft("diagram"),
        alt: attrs.alt,
        chart: props.chart,
        title: props.title,
      })
    ),
    Match.orElse(() => Option.none())
  );
