"use client";

import {
  type FigureAttrs,
  FigureAttrsSchema,
} from "@nakafa/aksara-contracts/assessment/figure";
import { lazy } from "@repo/design-system/lib/lazy";
import { Match, Option, Record as Rec, Schema } from "effect";
import { InlineContent } from "@/components/assessment/inline";
import { MermaidMdx } from "@/lib/content/renderer/client/base/media";
import { MathVisual } from "@/lib/content/renderer/client/base/visual/math";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

/** The data chart of a figure, whose code loads when a figure draws one, as a lesson's charts do. */
const SeriesChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/chart/series"
    ).then((module) => ({ default: module.SeriesChart }))
  )
);

/** The props one published figure component takes, by its name. */
type FigureProps<Name extends FigureAttrs["component"]> = Extract<
  FigureAttrs,
  { readonly component: Name }
>["props"];

/**
 * One figure of an assessment document: a data chart, a MathVisual scene, or a Mermaid diagram, drawn by the
 * component a lesson draws it with, under the figure's text alternative and over its caption.
 */
export function AssessmentFigure({ attrs }: { readonly attrs: FigureAttrs }) {
  return (
    <figure aria-label={attrs.alt} className="grid gap-2">
      {Match.value(attrs).pipe(
        Match.when({ component: "Chart" }, ({ props }) => (
          <ChartFigure props={props} />
        )),
        Match.when({ component: "MathVisual" }, ({ props }) => (
          <VisualFigure props={props} />
        )),
        Match.when({ component: "Mermaid" }, ({ props }) => (
          <MermaidMdx
            chart={props.chart}
            description={props.description}
            title={props.title}
          />
        )),
        Match.exhaustive
      )}
      {attrs.caption === null ? null : (
        <figcaption className="text-muted-foreground text-sm">
          <InlineContent nodes={attrs.caption} />
        </figcaption>
      )}
    </figure>
  );
}

/** A figure read from the attributes of a document's node. What the contract refuses draws nothing. */
export function DocumentFigure({ attrs }: { readonly attrs: unknown }) {
  const figure = Schema.decodeUnknownOption(FigureAttrsSchema)(attrs);
  if (Option.isNone(figure)) {
    return null;
  }
  return <AssessmentFigure attrs={figure.value} />;
}

/** A data chart: categories and the named series of bars or lines over them. */
function ChartFigure({ props }: { readonly props: FigureProps<"Chart"> }) {
  return (
    <SeriesChart
      bars={props.bars}
      categories={props.categories}
      description={<InlineContent nodes={props.description} />}
      series={props.series}
      title={<InlineContent nodes={props.title} />}
      valueLabel={props.valueLabel}
      valueRange={props.valueRange}
    />
  );
}

/** A plane or space scene, with the rich label of each anchor it names. */
function VisualFigure({
  props,
}: {
  readonly props: FigureProps<"MathVisual">;
}) {
  return (
    <MathVisual
      description={<InlineContent nodes={props.description} />}
      labels={Rec.map(props.labels, (label) => <InlineContent nodes={label} />)}
      scene={props.scene}
      title={<InlineContent nodes={props.title} />}
    />
  );
}
