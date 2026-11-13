import {
  dashed,
  fade,
  gradientRect,
  mix,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import { Schema } from "effect";
import type p5 from "p5";

/**
 * A graph drawn on a p5 canvas: a box in pixels and the ranges of time and of
 * the quantity it plots. Every sketch that draws a position-time or
 * velocity-time graph beside its scene maps through one of these, so every
 * curve, secant, and tangent lands where its value says.
 */
export const GraphSchema = Schema.Struct({
  box: Schema.Struct({
    height: Schema.Finite,
    width: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
  }),
  time: Schema.Tuple([Schema.Finite, Schema.Finite]),
  value: Schema.Tuple([Schema.Finite, Schema.Finite]),
});
export type Graph = typeof GraphSchema.Type;

/** The canvas x of a moment on the graph. */
export function graphX(graph: Graph, time: number) {
  const [start, end] = graph.time;
  return graph.box.x + ((time - start) / (end - start)) * graph.box.width;
}

/** The canvas y of a value on the graph, which grows upward. */
export function graphY(graph: Graph, value: number) {
  const [low, high] = graph.value;
  return (
    graph.box.y +
    graph.box.height -
    ((value - low) / (high - low)) * graph.box.height
  );
}

/**
 * The graph's paper: a dark panel, a faint grid at every `step` of time and
 * value, and the time axis at zero.
 */
export function paintGraph(
  sketch: p5,
  graph: Graph,
  step: { readonly time: number; readonly value: number }
) {
  const { box } = graph;
  gradientRect(sketch, box, [
    [0, mix(getColor("SLATE", 800), getColor("BLACK"), 0.2)],
    [1, mix(getColor("SLATE", 800), getColor("BLACK"), 0.5)],
  ]);
  sketch.push();
  sketch.strokeWeight(1);
  sketch.stroke(fade(getColor("SLATE", 400), 0.18));
  for (
    let time = graph.time[0];
    time <= graph.time[1] + 1e-9;
    time += step.time
  ) {
    sketch.line(
      graphX(graph, time),
      box.y,
      graphX(graph, time),
      box.y + box.height
    );
  }
  for (
    let value = Math.ceil(graph.value[0] / step.value) * step.value;
    value <= graph.value[1] + 1e-9;
    value += step.value
  ) {
    sketch.line(
      box.x,
      graphY(graph, value),
      box.x + box.width,
      graphY(graph, value)
    );
  }
  sketch.stroke(fade(getColor("SLATE", 200), 0.7));
  sketch.strokeWeight(1.5);
  const zero = Math.min(Math.max(graphY(graph, 0), box.y), box.y + box.height);
  sketch.line(box.x, zero, box.x + box.width, zero);
  sketch.line(box.x, box.y, box.x, box.y + box.height);
  sketch.pop();
}

/**
 * Draws `curve` from the graph's start up to `until`, sampled finely enough
 * that no corner shows, in one stroke.
 */
export function paintCurve(
  sketch: p5,
  graph: Graph,
  curve: (time: number) => number,
  style: {
    readonly color: string;
    readonly until: number;
    readonly weight: number;
  }
) {
  const [start, end] = graph.time;
  const last = Math.min(style.until, end);
  const samples = 240;
  sketch.push();
  sketch.noFill();
  sketch.stroke(style.color);
  sketch.strokeWeight(style.weight);
  sketch.beginShape();
  for (let index = 0; index <= samples; index += 1) {
    const time = start + ((last - start) * index) / samples;
    sketch.vertex(graphX(graph, time), graphY(graph, curve(time)));
  }
  sketch.endShape();
  sketch.pop();
}

/**
 * Draws a straight line through a point with a slope, across the whole time
 * range, dashed: a tangent, or a secant extended past its two points.
 */
export function paintSlopeLine(
  sketch: p5,
  graph: Graph,
  through: { readonly time: number; readonly value: number },
  slope: number,
  style: { readonly color: string; readonly weight: number }
) {
  const [start, end] = graph.time;
  dashed(
    sketch,
    {
      x: graphX(graph, start),
      y: graphY(graph, through.value + slope * (start - through.time)),
    },
    {
      x: graphX(graph, end),
      y: graphY(graph, through.value + slope * (end - through.time)),
    },
    { color: style.color, dash: 6, weight: style.weight }
  );
}

/** A dot on the graph at one moment, ringed so it reads over a curve. */
export function paintGraphDot(
  sketch: p5,
  graph: Graph,
  at: { readonly time: number; readonly value: number },
  color: string
) {
  sketch.push();
  sketch.stroke(getColor("WHITE"));
  sketch.strokeWeight(2);
  sketch.fill(color);
  sketch.circle(graphX(graph, at.time), graphY(graph, at.value), 11);
  sketch.pop();
}
