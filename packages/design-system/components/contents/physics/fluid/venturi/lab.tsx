import {
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { venturi } from "@repo/design-system/components/contents/physics/fluid/pressure";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How many tracer specks drift with the water. */
const SPECKS = 60;

/** The height of each open tube above the pipe, as a share of the canvas. */
const TUBE = 0.46;

/** What the sketch reads on every frame. */
const VenturiFrameSchema = Schema.Struct({
  drop: Schema.Finite,
  most: Schema.Finite,
  narrow: Schema.Finite,
  speed: Schema.Finite,
  wide: Schema.Finite,
});
type VenturiFrame = typeof VenturiFrameSchema.Type;

/**
 * Draws one moment: the horizontal pipe narrowing halfway, tracer specks
 * carried along at each section's speed, and an open tube above each section
 * whose water column stands lower above the narrow part by the drop that
 * Bernoulli's principle gives, drawn to the scale of the tubes.
 */
function venturiProgram(sketch: p5, read: () => VenturiFrame) {
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
    const top = height * 0.9;
    paintBench(sketch, top);
    const axis = height * 0.74;
    const wideHalf = height * 0.1;
    const narrowHalf = wideHalf * (frame.narrow / frame.wide);
    const middle = width / 2;
    const water = MATERIAL.kettleWater;
    gradientRect(
      sketch,
      { height: wideHalf * 2, width: middle, x: 0, y: axis - wideHalf },
      [
        [0, fade(water, 0.8)],
        [1, fade(mix(water, getColor("BLACK"), 0.3), 0.9)],
      ]
    );
    gradientRect(
      sketch,
      {
        height: narrowHalf * 2,
        width: middle,
        x: middle,
        y: axis - narrowHalf,
      },
      [
        [0, fade(water, 0.8)],
        [1, fade(mix(water, getColor("BLACK"), 0.3), 0.9)],
      ]
    );
    sketch.noStroke();
    const fast = frame.speed * (frame.wide / frame.narrow) ** 2;
    // Pixels a speck moves each second for each metre per second of flow.
    const pace = width * 0.3;
    const wideTime = middle / (pace * frame.speed);
    const narrowTime = middle / (pace * fast);
    Arr.forEach(
      Arr.makeBy(SPECKS, (index) => index),
      (index) => {
        const lane = hashUnit(index, 1) * 2 - 1;
        const phase =
          (hashUnit(index, 0) * (wideTime + narrowTime) + clock) %
          (wideTime + narrowTime);
        const inWide = phase < wideTime;
        const x = inWide
          ? (phase / wideTime) * middle
          : middle + ((phase - wideTime) / narrowTime) * middle;
        sketch.fill(fade(getColor("WHITE"), 0.7));
        sketch.circle(
          x,
          axis + lane * (inWide ? wideHalf : narrowHalf) * 0.8,
          3
        );
      }
    );
    sketch.stroke(fade(MATERIAL.glass, 0.8));
    sketch.strokeWeight(3);
    sketch.line(0, axis - wideHalf, middle, axis - wideHalf);
    sketch.line(middle, axis - wideHalf, middle, axis - narrowHalf);
    sketch.line(middle, axis - narrowHalf, width, axis - narrowHalf);
    sketch.line(0, axis + wideHalf, middle, axis + wideHalf);
    sketch.line(middle, axis + wideHalf, middle, axis + narrowHalf);
    sketch.line(middle, axis + narrowHalf, width, axis + narrowHalf);
    const tubeWidth = width * 0.05;
    const tubeTop = axis - height * TUBE;
    const metre = (height * TUBE * 0.8) / Math.max(frame.most, 0.05);
    const wideLevel = tubeTop + height * TUBE * 0.12;
    const narrowLevel = wideLevel + frame.drop * metre;
    Arr.forEach(
      [
        { level: wideLevel, base: axis - wideHalf, x: width * 0.25 },
        { level: narrowLevel, base: axis - narrowHalf, x: width * 0.75 },
      ],
      (tube) => {
        gradientRect(
          sketch,
          {
            height: tube.base - tube.level,
            width: tubeWidth,
            x: tube.x - tubeWidth / 2,
            y: tube.level,
          },
          [
            [0, fade(water, 0.85)],
            [1, fade(mix(water, getColor("BLACK"), 0.3), 0.9)],
          ],
          true
        );
        sketch.noFill();
        sketch.stroke(fade(MATERIAL.glass, 0.8));
        sketch.strokeWeight(2);
        sketch.line(
          tube.x - tubeWidth / 2,
          tubeTop,
          tube.x - tubeWidth / 2,
          tube.base
        );
        sketch.line(
          tube.x + tubeWidth / 2,
          tubeTop,
          tube.x + tubeWidth / 2,
          tube.base
        );
      }
    );
    dashed(
      sketch,
      { x: width * 0.25, y: wideLevel },
      { x: width * 0.8, y: wideLevel },
      {
        color: fade(PLOT_COLORS.amber, 0.85),
        dash: 5,
        weight: 1.5,
      }
    );
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(2);
    sketch.line(width * 0.82, wideLevel, width * 0.82, narrowLevel);
    vignette(sketch, 0.3);
  };
}

interface VenturiTubeLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    drop: ReactNode;
    faster: ReactNode;
    speed: ReactNode;
    speedName: string;
    viewLabel: string;
  };
  /** The diameter of the narrow section, in centimetres. */
  narrow: number;
  /** The water speed in the wide section the lab starts at, in m s⁻¹. */
  speed: number;
  title: NonNullable<ReactNode>;
  /** The diameter of the wide section, in centimetres. */
  wide: number;
}

/**
 * Water flows steadily through a horizontal pipe that narrows halfway, with
 * an open tube above each section. The same volume passes every second, so
 * the water runs faster through the narrow part, as the tracer specks show,
 * and there its pressure is lower, so its tube holds a shorter column. Speed
 * the flow up and watch the difference between the columns grow.
 */
export function VenturiTubeLab({
  description,
  labels,
  narrow,
  speed: start,
  title,
  wide,
}: VenturiTubeLabProps) {
  const quantity = useQuantity();
  const [speed, setSpeed] = useState(start);
  const flow = venturi(wide, narrow, speed);
  const most = venturi(wide, narrow, Math.max(1, start * 2)).drop;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.speed}</span>}
          max={Math.max(1, start * 2)}
          min={0.1}
          name={labels.speedName}
          onValueChange={setSpeed}
          readout={
            <InlineMath math={quantity(speed, "\\text{ m s}^{-1}", 2)} />
          }
          step={0.05}
          value={speed}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={venturiProgram}
          state={{ drop: flow.drop, most, narrow, speed, wide }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.faster}
            value={
              <InlineMath
                math={quantity(flow.faster, "\\text{ m s}^{-1}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.drop}
            value={
              <InlineMath math={quantity(flow.drop * 100, "\\text{ cm}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
