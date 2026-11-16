import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import type { InlineNode } from "@nakafa/aksara-contracts/assessment/inline";
import { assessmentVisuals } from "@nakafa/aksara-contracts/visual/catalog";
import { Array as Arr, Option, Schema, String as Str } from "effect";
import type { FigureDraft } from "@/components/tenant/exams/figure/form";
import {
  PlaneDraft,
  sceneOf,
} from "@/components/tenant/exams/figure/graph/plane";
import { newShape } from "@/components/tenant/exams/figure/graph/shapes";
import {
  type GraphProps,
  planeOf,
} from "@/components/tenant/exams/figure/graph/stored";

/**
 * What a teacher writes for a graph, as the fields hold it: every number as typed, so a value on its way never
 * jumps. It reads its plane (the objects on it, the sliders and the range it shows), its title and the words it
 * says to a student who cannot see it.
 */
export const GraphDraft = Schema.Struct({
  ...PlaneDraft.fields,
  alt: Schema.String,
  title: Schema.String,
});
export type GraphDraft = typeof GraphDraft.Type;

/** A new graph: one function on a plane that fits itself around it. */
export const emptyGraph = (): GraphDraft => ({
  alt: "",
  shapes: [newShape("function", "function-1", 0)],
  sliders: [],
  space: "plane",
  title: "",
  view: "auto",
  xMax: "5",
  xMin: "-5",
  yMax: "5",
  yMin: "-5",
  zMax: "5",
  zMin: "-5",
});

/** Rich text of one line of plain words, as a figure's title and description hold it. */
const richText = (text: string) => [{ text, type: "text" as const }];

/** Reads the props of a MathVisual as the catalog checks them. */
const decodeProps = Schema.decodeUnknownOption(
  assessmentVisuals.MathVisual.props
);

/**
 * The props of the MathVisual a graph makes, as the catalog reads them, or none while a number is missing, a
 * formula does not read, or an object leaves the plane.
 */
export const propsOf = (draft: GraphDraft): Option.Option<GraphProps> =>
  Option.flatMap(sceneOf(draft), ({ labels, scene }) =>
    decodeProps({
      description: richText(draft.alt),
      labels,
      scene,
      title: richText(draft.title),
    })
  );

/** The words a preview shows in place of a title or a description the teacher has not written yet. */
const BLANK = " ";

/**
 * The figure the preview draws: the MathVisual the graph makes, as the student reads it, drawn before the teacher
 * names or describes it. A title or a description still empty reads as a blank, which the saved figure never holds.
 */
export const previewOf = (draft: GraphDraft): Option.Option<FigureAttrs> =>
  Option.map(
    propsOf({
      ...draft,
      alt: Str.isNonEmpty(Str.trim(draft.alt)) ? draft.alt : BLANK,
      title: Str.isNonEmpty(Str.trim(draft.title)) ? draft.title : BLANK,
    }),
    (props) => ({
      alt: draft.alt,
      caption: null,
      component: "MathVisual" as const,
      props,
    })
  );

/**
 * The catalog draft of a graph: a MathVisual with the props the graph makes, or with none while it makes none, so
 * the catalog refuses it and nothing is saved. Its caption stays as the figure held it.
 */
export const figureDraftOf = (
  draft: GraphDraft,
  caption: string
): FigureDraft => ({
  alt: draft.alt,
  caption,
  component: "MathVisual",
  props: Option.getOrNull(propsOf(draft)),
});

/** The plain words of rich text, as a graph's title field holds them. */
const plainOf = (nodes: readonly InlineNode[]) =>
  Arr.join(
    Arr.map(nodes, (node) => (node.type === "text" ? node.text : "")),
    ""
  );

/**
 * The graph of a catalog draft, so the teacher edits what stands there, or none for a figure the builder cannot
 * write: another visual, a MathVisual whose props its schema refuses, or a scene with a solid, a parametric curve
 * or readouts. A figure without a graph keeps the catalog's own form.
 */
export const graphOf = (draft: FigureDraft): Option.Option<GraphDraft> =>
  draft.component === "MathVisual"
    ? Option.flatMap(decodeProps(draft.props), (props) =>
        Option.map(planeOf(props), (plane) => ({
          ...emptyGraph(),
          ...plane,
          alt: draft.alt,
          title: plainOf(props.title),
        }))
      )
    : Option.none();
