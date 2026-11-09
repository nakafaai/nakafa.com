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
import {
  PlaneView,
  planeOf,
  SliderDraft,
  sceneOf,
} from "@/components/tenant/exams/figure/plane";
import {
  newShape,
  numberOf,
  ShapeDraft,
} from "@/components/tenant/exams/figure/shapes";

/** The figures a teacher makes: a graph on a plane, a chart of values, or a diagram. */
export const FigureKind = Schema.Literals(["graph", "chart", "diagram"]);
export type FigureKind = typeof FigureKind.Type;

/** How a chart draws its values. */
export const ChartMark = Schema.Literals(["bar", "line"]);
export type ChartMark = typeof ChartMark.Type;

/**
 * What a teacher writes for a figure, as the fields hold it: every number as typed, so a value on its way never
 * jumps. A graph reads its plane: the objects on it, the sliders, and the range it shows. A chart and a diagram
 * read their own fields, and each kind leaves the others as they stand.
 */
export const FigureDraft = Schema.Struct({
  alt: Schema.String,
  categories: Schema.String,
  chart: Schema.String,
  kind: FigureKind,
  mark: ChartMark,
  shapes: Schema.Array(ShapeDraft),
  sliders: Schema.Array(SliderDraft),
  title: Schema.String,
  values: Schema.String,
  view: PlaneView,
  xMax: Schema.String,
  xMin: Schema.String,
  yMax: Schema.String,
  yMin: Schema.String,
});
export type FigureDraft = typeof FigureDraft.Type;

/** A new figure of a kind. A graph starts with one function on a plane that fits itself around it. */
export const emptyDraft = (kind: FigureKind): FigureDraft => ({
  alt: "",
  categories: "",
  chart: "",
  kind,
  mark: "bar",
  shapes: kind === "graph" ? [newShape("function", "function-1", 0)] : [],
  sliders: [],
  title: "",
  values: "",
  view: "auto",
  xMax: "5",
  xMin: "-5",
  yMax: "5",
  yMin: "-5",
});

/** Rich text of one line of plain words, as a figure's title and description hold it. */
const richText = (text: string) => [{ text, type: "text" }];

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

/** The component and the props of a draft, before the contract reads them. */
const propsOf = (draft: FigureDraft) => {
  const title = richText(draft.title);
  const description = richText(draft.alt);
  return Match.value(draft.kind).pipe(
    Match.when("graph", () =>
      Option.map(sceneOf(draft), ({ labels, scene }) => ({
        component: "MathVisual",
        props: { description, labels, scene, title },
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
 * number that is no number, a formula that does not read, an object outside the plane, or a chart whose values
 * do not match its labels.
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

/**
 * The draft of a figure already in a text, so the teacher edits what stands there. A figure the builder cannot
 * write, as a space scene or a curve a release brought in, has none, and its text stays as it is.
 */
export const draftOf = (attrs: FigureAttrs): Option.Option<FigureDraft> =>
  Match.value(attrs).pipe(
    Match.when({ component: "MathVisual" }, (graph) =>
      Option.map(planeOf(graph), (plane) => ({
        ...emptyDraft("graph"),
        ...plane,
        alt: attrs.alt,
        title: plainOf(graph.props.title),
      }))
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
    Match.exhaustive
  );
