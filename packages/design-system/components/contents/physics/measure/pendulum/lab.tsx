import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { pendulumLine } from "@repo/design-system/components/contents/physics/measure/data";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** Where the lengths are measured to: the top of the bob, or its centre. */
const MeasureSchema = Schema.Literals(["top", "centre"]);
type Measure = typeof MeasureSchema.Type;

/** The longest length the graph shows, in metres. */
const LONGEST = 1;

/** What the sketch reads on every frame. */
const PendulumFrameSchema = Schema.Struct({
  gradient: Schema.Finite,
  measure: MeasureSchema,
  radius: Schema.Finite,
});
type PendulumFrame = typeof PendulumFrameSchema.Type;

/**
 * Draws the pendulum on its stand with the measured length bracketed to the
 * top or the centre of the bob, and beside it the graph of T² against the
 * measured length: the line of lengths to the centre through the origin and
 * the line of lengths to the top shifted left by the bob's radius, the
 * chosen one bold.
 */
function pendulumProgram(sketch: p5, read: () => PendulumFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, mix(ENERGY_COLORS.wallPlaster, getColor("BLACK"), 0.55)],
      [1, mix(ENERGY_COLORS.wallPlaster, getColor("BLACK"), 0.7)],
    ]);
    const pivot = { x: width * 0.2, y: height * 0.12 };
    const string = height * 0.58;
    const bob = Math.max(10, width * 0.035);
    const swing = 0.25 * Math.sin(clock * Math.PI * 1.2);
    const centre = {
      x: pivot.x + Math.sin(swing) * (string + bob),
      y: pivot.y + Math.cos(swing) * (string + bob),
    };
    sketch.stroke(CAR_COLORS.castIron);
    sketch.strokeWeight(5);
    sketch.line(width * 0.06, pivot.y, width * 0.34, pivot.y);
    sketch.stroke(fade(getColor("WHITE"), 0.8));
    sketch.strokeWeight(1.5);
    sketch.line(
      pivot.x,
      pivot.y,
      pivot.x + Math.sin(swing) * string,
      pivot.y + Math.cos(swing) * string
    );
    litBall(sketch, centre, bob, {
      dark: mix(INSTRUMENT_COLORS.brass, getColor("BLACK"), 0.4),
      light: mix(INSTRUMENT_COLORS.brass, getColor("WHITE"), 0.4),
    });
    const measured =
      frame.measure === "top" ? pivot.y + string : pivot.y + string + bob;
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(2);
    sketch.line(width * 0.07, pivot.y, width * 0.07, measured);
    sketch.line(width * 0.05, measured, width * 0.09, measured);
    caption(
      sketch,
      "l",
      { x: width * 0.05, y: (pivot.y + measured) / 2 },
      { align: "right", baseline: "middle", color: PLOT_COLORS.amber, size: 15 }
    );
    const graph = {
      bottom: height * 0.88,
      left: width * 0.46,
      right: width * 0.95,
      top: height * 0.1,
    };
    const shift = frame.radius * 2.5;
    const x = (length: number) =>
      graph.left +
      ((length + shift) / (LONGEST + shift)) * (graph.right - graph.left);
    const y = (squared: number) =>
      graph.bottom -
      (squared / (frame.gradient * (LONGEST + frame.radius) * 1.05)) *
        (graph.bottom - graph.top);
    sketch.noStroke();
    sketch.fill(fade(getColor("ZINC", 950), 0.7));
    sketch.rect(
      graph.left - 16,
      graph.top - 12,
      graph.right - graph.left + 26,
      graph.bottom - graph.top + 30,
      8
    );
    sketch.stroke(fade(getColor("WHITE"), 0.7));
    sketch.strokeWeight(1.5);
    sketch.line(graph.left, y(0), graph.right, y(0));
    sketch.line(x(0), graph.bottom, x(0), graph.top);
    const line = frame.measure === "top";
    sketch.stroke(line ? PLOT_COLORS.pink : fade(PLOT_COLORS.pink, 0.35));
    sketch.strokeWeight(line ? 3 : 1.5);
    sketch.line(
      x(-frame.radius),
      y(0),
      x(LONGEST),
      y(frame.gradient * (LONGEST + frame.radius))
    );
    sketch.stroke(line ? fade(PLOT_COLORS.teal, 0.35) : PLOT_COLORS.teal);
    sketch.strokeWeight(line ? 1.5 : 3);
    sketch.line(x(0), y(0), x(LONGEST), y(frame.gradient * LONGEST));
    dashed(
      sketch,
      { x: x(0), y: y(frame.gradient * frame.radius) },
      { x: x(0) + 30, y: y(frame.gradient * frame.radius) },
      {
        color: fade(PLOT_COLORS.pink, 0.8),
        dash: 3,
        weight: 1,
      }
    );
    // A magnified view of the origin, where the bob's radius shifts the line.
    const zoom = {
      bottom: graph.top + (graph.bottom - graph.top) * 0.48,
      left: graph.left + 18,
      right: graph.left + (graph.right - graph.left) * 0.55,
      top: graph.top + 16,
    };
    const near = frame.radius * 3;
    const zx = (length: number) =>
      zoom.left + ((length + near) / (2 * near)) * (zoom.right - zoom.left);
    const zy = (squared: number) =>
      zoom.bottom -
      (squared / (frame.gradient * near * 2)) * (zoom.bottom - zoom.top);
    sketch.noStroke();
    sketch.fill(fade(getColor("ZINC", 900), 0.95));
    sketch.rect(
      zoom.left,
      zoom.top,
      zoom.right - zoom.left,
      zoom.bottom - zoom.top,
      6
    );
    sketch.stroke(fade(getColor("WHITE"), 0.5));
    sketch.strokeWeight(1);
    sketch.line(zoom.left, zy(0), zoom.right, zy(0));
    sketch.line(zx(0), zoom.bottom, zx(0), zoom.top);
    sketch.stroke(line ? PLOT_COLORS.pink : fade(PLOT_COLORS.pink, 0.4));
    sketch.strokeWeight(line ? 2.5 : 1.5);
    sketch.line(
      zx(-frame.radius),
      zy(0),
      zx(near),
      zy(frame.gradient * (near + frame.radius))
    );
    sketch.stroke(line ? fade(PLOT_COLORS.teal, 0.4) : PLOT_COLORS.teal);
    sketch.strokeWeight(line ? 1.5 : 2.5);
    sketch.line(zx(0), zy(0), zx(near), zy(frame.gradient * near));
    sketch.noStroke();
    sketch.fill(PLOT_COLORS.pink);
    sketch.circle(zx(-frame.radius), zy(0), 7);
    sketch.circle(zx(0), zy(frame.gradient * frame.radius), 7);
    sketch.noFill();
    sketch.stroke(fade(getColor("WHITE"), 0.35));
    sketch.rect(
      x(-near),
      y(frame.gradient * near * 2),
      x(near) - x(-near),
      y(0) - y(frame.gradient * near * 2)
    );
    const axis = { color: fade(getColor("WHITE"), 0.85), size: 12 } as const;
    caption(
      sketch,
      "T²",
      { x: x(0) - 6, y: graph.top + 4 },
      { ...axis, align: "right", baseline: "middle" }
    );
    caption(
      sketch,
      "l",
      { x: graph.right, y: y(0) + 6 },
      { ...axis, align: "center", baseline: "top" }
    );
    vignette(sketch, 0.3);
  };
}

interface PendulumGraphLabProps {
  description: NonNullable<ReactNode>;
  /** The gradient of the T² against l graph, in s² m⁻¹. */
  gradient: number;
  labels: {
    gravity: ReactNode;
    lengthIntercept: ReactNode;
    measure: string;
    measures: Record<Measure, ReactNode>;
    periodIntercept: ReactNode;
    viewLabel: string;
  };
  /** The radius of the bob, in metres. */
  radius: number;
  title: NonNullable<ReactNode>;
}

/**
 * A simple pendulum and its graph of T² against the measured length. The
 * period depends on the length to the centre of the bob, so lengths measured
 * to its top fall short by the radius: their line keeps the same gradient,
 * and so the same g, but moves left, cutting the T² axis above zero and the
 * length axis at minus the radius.
 */
export function PendulumGraphLab({
  description,
  gradient,
  labels,
  radius,
  title,
}: PendulumGraphLabProps) {
  const quantity = useQuantity();
  const [measure, setMeasure] = useState<Measure>("top");
  const isMeasure = Schema.is(MeasureSchema);
  const line = pendulumLine(gradient, measure === "top" ? radius : 0);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.measure}
          onValueChange={(value) => {
            if (isMeasure(value)) {
              setMeasure(value);
            }
          }}
          type="single"
          value={measure}
          variant="outline"
        >
          <ToggleGroupItem value="top">{labels.measures.top}</ToggleGroupItem>
          <ToggleGroupItem value="centre">
            {labels.measures.centre}
          </ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={pendulumProgram}
          state={{ gradient, measure, radius }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.gravity}
            value={
              <InlineMath
                math={quantity(line.gravity, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.periodIntercept}
            value={
              <InlineMath
                math={quantity(line.periodIntercept, "\\text{ s}^2", 3)}
              />
            }
          />
          <VisualFactTabular
            label={labels.lengthIntercept}
            value={
              <InlineMath
                math={quantity(line.lengthIntercept, "\\text{ m}", 3)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
