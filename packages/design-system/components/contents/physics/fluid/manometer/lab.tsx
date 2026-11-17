import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  arrow,
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { manometer } from "@repo/design-system/components/contents/physics/fluid/pressure";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
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
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame: the level difference and the largest one the slider reaches, in centimetres. */
const ManometerFrameSchema = Schema.Struct({
  difference: Schema.Finite,
  most: Schema.Finite,
});
type ManometerFrame = typeof ManometerFrameSchema.Type;

/**
 * Draws one moment of the U-tube: the gas tap on the left arm, the open
 * right arm, the liquid pushed down on the gas side by half the difference
 * and up on the open side by the other half, and the difference between the
 * two levels bracketed.
 */
function manometerProgram(sketch: p5, read: () => ManometerFrame) {
  let shown = read().difference;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    shown +=
      (frame.difference - shown) *
      Math.min(Math.min(sketch.deltaTime / 1000, 0.1) * 4, 1);
    const { height, width } = sketch;
    const top = height * 0.92;
    paintBench(sketch, top);
    const bend = top - height * 0.1;
    const armTop = height * 0.12;
    const left = width * 0.3;
    const right = width * 0.62;
    const bore = width * 0.06;
    const centimetre = ((bend - armTop) * 0.8) / Math.max(frame.most * 1.1, 1);
    const rest = (bend + armTop) / 2 + height * 0.06;
    const gasLevel = rest + (shown / 2) * centimetre;
    const openLevel = rest - (shown / 2) * centimetre;
    const liquid = MATERIAL.kettleWater;
    const fill = (x: number, level: number) =>
      gradientRect(
        sketch,
        { height: bend - level, width: bore, x: x - bore / 2, y: level },
        [
          [0, fade(liquid, 0.85)],
          [1, fade(mix(liquid, getColor("BLACK"), 0.3), 0.9)],
        ],
        true
      );
    fill(left, gasLevel);
    fill(right, openLevel);
    gradientRect(
      sketch,
      { height: bore, width: right - left + bore, x: left - bore / 2, y: bend },
      [
        [0, fade(liquid, 0.85)],
        [1, fade(mix(liquid, getColor("BLACK"), 0.3), 0.9)],
      ]
    );
    sketch.noFill();
    sketch.stroke(fade(MATERIAL.glass, 0.8));
    sketch.strokeWeight(2.5);
    for (const x of [left, right]) {
      sketch.line(x - bore / 2, armTop, x - bore / 2, bend + bore);
      sketch.line(x + bore / 2, armTop, x + bore / 2, bend);
    }
    sketch.line(left - bore / 2, bend + bore, right + bore / 2, bend + bore);
    sketch.line(left + bore / 2, bend, right - bore / 2, bend);
    sketch.line(right + bore / 2, bend, right + bore / 2, bend + bore);
    sketch.noStroke();
    sketch.fill(MATERIAL.brass);
    sketch.rect(
      left - bore,
      armTop - height * 0.04,
      bore * 2,
      height * 0.04,
      3
    );
    sketch.fill(MATERIAL.galvanizedSteel);
    sketch.rect(
      left - bore * 0.3,
      armTop - height * 0.1,
      bore * 0.6,
      height * 0.06
    );
    arrow(
      sketch,
      { x: left, y: armTop + height * 0.04 },
      { x: left, y: gasLevel - 6 },
      { color: PLOT_COLORS.pink, head: 10, weight: 3 }
    );
    arrow(
      sketch,
      { x: right, y: armTop - height * 0.04 },
      { x: right, y: openLevel - 6 },
      { color: PLOT_COLORS.teal, head: 10, weight: 3 }
    );
    const mark = right + bore * 1.6;
    dashed(
      sketch,
      { x: left, y: gasLevel },
      { x: mark + 10, y: gasLevel },
      { color: fade(getColor("WHITE"), 0.6), dash: 4, weight: 1 }
    );
    dashed(
      sketch,
      { x: right, y: openLevel },
      { x: mark + 10, y: openLevel },
      { color: fade(getColor("WHITE"), 0.6), dash: 4, weight: 1 }
    );
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(2);
    sketch.line(mark, gasLevel, mark, openLevel);
    caption(
      sketch,
      "h",
      { x: mark + 8, y: (gasLevel + openLevel) / 2 },
      {
        align: "left",
        baseline: "middle",
        color: PLOT_COLORS.amber,
        size: 14,
      }
    );
    vignette(sketch, 0.3);
  };
}

interface ManometerLabProps {
  /** The atmospheric pressure, in cm of the reference liquid. */
  atmosphere: number;
  description: NonNullable<ReactNode>;
  /** How much lower the liquid stands on the gas side at the start, in centimetres. */
  difference: number;
  labels: {
    difference: ReactNode;
    differenceName: string;
    excess: ReactNode;
    gas: ReactNode;
    viewLabel: string;
  };
  /** The density of the manometer liquid, in g cm⁻³. */
  liquidDensity: number;
  /** The density of the liquid the pressures are measured in, such as mercury, in g cm⁻³. */
  referenceDensity: number;
  title: NonNullable<ReactNode>;
}

/**
 * A U-tube manometer with one arm on a gas supply and the other open to the
 * air. The gas pushes its side down until the extra column on the open side
 * balances the extra pressure, so the gas pressure is the atmosphere's plus
 * that column, turned into the reference liquid by the ratio of densities.
 * Turn the gas up or down and watch both levels move.
 */
export function ManometerLab({
  atmosphere,
  description,
  difference: start,
  labels,
  liquidDensity,
  referenceDensity,
  title,
}: ManometerLabProps) {
  const quantity = useQuantity();
  const [difference, setDifference] = useState(start);
  const reading = manometer(
    difference,
    { liquid: liquidDensity, reference: referenceDensity },
    atmosphere
  );
  const most = Math.max(start * 1.5, 10);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.difference}</span>}
          max={Math.ceil(most)}
          min={0}
          name={labels.differenceName}
          onValueChange={setDifference}
          readout={<InlineMath math={quantity(difference, "\\text{ cm}", 1)} />}
          step={0.1}
          value={difference}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={manometerProgram}
          state={{ difference, most }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.excess}
            value={
              <InlineMath
                math={quantity(reading.excess, "\\text{ cm Hg}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.gas}
            value={
              <InlineMath math={quantity(reading.gas, "\\text{ cm Hg}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
