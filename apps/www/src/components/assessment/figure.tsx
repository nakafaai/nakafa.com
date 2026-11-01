"use client";

import {
  type FigureAttrs,
  FigureAttrsSchema,
} from "@nakafa/aksara-contracts/assessment/figure";
import { LineReadouts } from "@repo/design-system/components/contents/mathematics/line/readouts";
import {
  Array as Arr,
  Match,
  Option,
  Record as Rec,
  Schema,
  Struct,
} from "effect";
import { lazy } from "react";
import { InlineContent } from "@/components/assessment/inline";
import { MermaidMdx } from "@/lib/content/renderer/client/base/media";
import { MathVisual } from "@/lib/content/renderer/client/base/visual/math";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";
import { LineEquation } from "@/lib/content/renderer/client/mathematics/equation";
import { UnitCircle } from "@/lib/content/renderer/client/mathematics/geometry";
import { NumberLine } from "@/lib/content/renderer/client/snbt/math/number";

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

/** A camera pose or an offset as the scenes take it: x, y, and z. */
function triple([x, y, z]: readonly [number, number, number]): [
  number,
  number,
  number,
] {
  return [x, y, z];
}

/**
 * One figure of an assessment document: the published component it names, drawn by the component a
 * lesson draws it with, under the figure's text alternative and over its caption.
 */
export function AssessmentFigure({ attrs }: { readonly attrs: FigureAttrs }) {
  return (
    <figure aria-label={attrs.alt} className="grid gap-2">
      {Match.value(attrs).pipe(
        Match.when({ component: "Chart" }, ({ props }) => (
          <ChartFigure props={props} />
        )),
        Match.when({ component: "LineEquation" }, ({ props }) => (
          <LineFigure props={props} />
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
        Match.when({ component: "NumberLine" }, ({ props }) => (
          <NumberFigure props={props} />
        )),
        Match.when({ component: "UnitCircle" }, ({ props }) => (
          <UnitCircle
            angle={props.angle}
            description={<InlineContent nodes={props.description} />}
            title={<InlineContent nodes={props.title} />}
            trigValues={props.trigValues}
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

/** Lines in three dimensions, with the labels each line carries at its points and the readouts of the scene. */
function LineFigure({
  props,
}: {
  readonly props: FigureProps<"LineEquation">;
}) {
  return (
    <LineEquation
      data={Arr.map(props.data, (line) => ({
        ...Struct.omit(line, ["labels", "pointIndices", "points"]),
        ...(line.labels === undefined
          ? {}
          : {
              labels: Arr.map(line.labels, (label) => ({
                ...Struct.omit(label, ["offset", "text"]),
                ...(label.offset === undefined
                  ? {}
                  : { offset: triple(label.offset) }),
                text: <InlineContent nodes={label.text} />,
              })),
            }),
        ...(line.pointIndices === undefined
          ? {}
          : { pointIndices: [...line.pointIndices] }),
        points: [...line.points],
      }))}
      description={<InlineContent nodes={props.description} />}
      facts={<LineReadouts />}
      title={<InlineContent nodes={props.title} />}
      {...(props.cameraPosition === undefined
        ? {}
        : { cameraPosition: triple(props.cameraPosition) })}
      {...(props.cameraTarget === undefined
        ? {}
        : { cameraTarget: triple(props.cameraTarget) })}
      {...(props.showZAxis === undefined ? {} : { showZAxis: props.showZAxis })}
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

/**
 * Segments on a number line. A segment that starts at minus infinity or ends at plus infinity leaves
 * that end out, which the line draws as a ray to the edge of its axis.
 */
function NumberFigure({
  props,
}: {
  readonly props: FigureProps<"NumberLine">;
}) {
  return (
    <NumberLine
      description={<InlineContent nodes={props.description} />}
      segments={Arr.map(props.segments, (segment) => ({
        ...Struct.omit(segment, [
          "end",
          "endLabel",
          "label",
          "start",
          "startLabel",
        ]),
        ...(segment.end === "infinity" ? {} : { end: segment.end }),
        ...(segment.endLabel === undefined
          ? {}
          : { endLabel: <InlineContent nodes={segment.endLabel} /> }),
        ...(segment.label === undefined
          ? {}
          : { label: <InlineContent nodes={segment.label} /> }),
        ...(segment.start === "-infinity" ? {} : { start: segment.start }),
        ...(segment.startLabel === undefined
          ? {}
          : { startLabel: <InlineContent nodes={segment.startLabel} /> }),
      }))}
      title={<InlineContent nodes={props.title} />}
      {...(props.max === undefined ? {} : { max: props.max })}
      {...(props.min === undefined ? {} : { min: props.min })}
    />
  );
}
