import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { springChain } from "@repo/design-system/components/contents/physics/mechanics/force";
import { paintRoom } from "@repo/design-system/components/contents/physics/mechanics/stage";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** The natural length of each spring, in centimetres. */
const NATURAL = 10;

/** How many coils each spring is drawn with. */
const COILS = 8;

/** What the sketch reads on every frame: each spring's extension and the largest total the slider reaches, in centimetres. */
const SpringFrameSchema = Schema.Struct({
  most: Schema.Finite,
  pair: Schema.Finite,
  top: Schema.Finite,
});
type SpringFrame = typeof SpringFrameSchema.Type;

/** How far coil point `index` sits from the spring's axis: none at the two ends, then alternately left and right. */
function sway(index: number, wide: number) {
  if (index === 0 || index === COILS * 2) {
    return 0;
  }
  return index % 2 === 0 ? -wide : wide;
}

/** A coiled spring from `top` down to `bottom` at `x`, its coils spread over its stretched length. */
function coil(
  sketch: p5,
  x: number,
  top: number,
  bottom: number,
  wide: number
) {
  const points = Arr.makeBy(COILS * 2 + 1, (index) => ({
    x: x + sway(index, wide),
    y: top + ((bottom - top) * index) / (COILS * 2),
  }));
  sketch.stroke(mix(CAR_COLORS.chrome, getColor("BLACK"), 0.2));
  sketch.strokeWeight(2.5);
  for (const [a, b] of Arr.zip(points, Arr.drop(points, 1))) {
    sketch.line(a.x, a.y, b.x, b.y);
  }
}

/**
 * Draws the springs to scale against a centimetre rule: spring P hanging
 * from the ceiling, the bar under it carrying springs Q and R side by side,
 * and the load on the lower bar, each spring stretched by the force it
 * carries, with the natural lengths dashed beside them.
 */
function springProgram(sketch: p5, read: () => SpringFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const { height, width } = sketch;
    paintRoom(sketch, height * 0.96);
    const ceiling = height * 0.06;
    const centimetre = (height * 0.66) / (2 * NATURAL + frame.most);
    gradientRect(
      sketch,
      { height: 10, width: width * 0.5, x: width * 0.25, y: ceiling - 10 },
      [
        [0, CAR_COLORS.castIron],
        [1, mix(CAR_COLORS.castIron, getColor("BLACK"), 0.4)],
      ]
    );
    const centre = width * 0.5;
    const firstBar = ceiling + (NATURAL + frame.top) * centimetre;
    const secondBar = firstBar + (NATURAL + frame.pair) * centimetre;
    coil(sketch, centre, ceiling, firstBar, width * 0.035);
    sketch.noStroke();
    sketch.fill(INSTRUMENT_COLORS.aluminium);
    sketch.rect(centre - width * 0.12, firstBar, width * 0.24, 6);
    coil(sketch, centre - width * 0.09, firstBar + 6, secondBar, width * 0.03);
    coil(sketch, centre + width * 0.09, firstBar + 6, secondBar, width * 0.03);
    sketch.fill(INSTRUMENT_COLORS.aluminium);
    sketch.rect(centre - width * 0.12, secondBar, width * 0.24, 6);
    sketch.stroke(BENCH_COLORS.probeSteel);
    sketch.strokeWeight(2);
    sketch.line(centre, secondBar + 6, centre, secondBar + 18);
    sketch.noStroke();
    sketch.fill(CAR_COLORS.castIron);
    sketch.rect(
      centre - width * 0.07,
      secondBar + 18,
      width * 0.14,
      height * 0.09,
      4
    );
    const rule = width * 0.82;
    sketch.fill(INSTRUMENT_COLORS.metreRule);
    sketch.rect(rule, ceiling, 18, height * 0.84);
    sketch.stroke(fade(getColor("BLACK"), 0.7));
    sketch.strokeWeight(1);
    for (let mark = 0; mark * centimetre < height * 0.84; mark += 1) {
      const y = ceiling + mark * centimetre;
      sketch.line(rule, y, rule + (mark % 5 === 0 ? 12 : 6), y);
    }
    sketch.stroke(PLOT_COLORS.teal);
    sketch.strokeWeight(2);
    const natural = ceiling + 2 * NATURAL * centimetre + 6;
    sketch.line(rule - 30, natural, rule, natural);
    sketch.stroke(PLOT_COLORS.pink);
    sketch.line(rule - 30, secondBar, rule, secondBar);
    const mark = {
      align: "right",
      baseline: "middle",
      color: getColor("WHITE"),
      size: 13,
    } as const;
    caption(
      sketch,
      "P",
      { x: centre - width * 0.06, y: (ceiling + firstBar) / 2 },
      mark
    );
    caption(
      sketch,
      "Q",
      { x: centre - width * 0.14, y: (firstBar + secondBar) / 2 },
      mark
    );
    caption(
      sketch,
      "R",
      { x: centre + width * 0.17, y: (firstBar + secondBar) / 2 },
      { ...mark, align: "left" }
    );
    vignette(sketch, 0.3);
  };
}

interface SpringChainLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    load: ReactNode;
    loadName: string;
    pair: ReactNode;
    top: ReactNode;
    total: ReactNode;
    viewLabel: string;
  };
  /** The load the springs carry at the start, in newtons. */
  load: number;
  /** The spring constant of each identical spring, in N m⁻¹. */
  stiffness: number;
  title: NonNullable<ReactNode>;
}

/**
 * Spring P hangs from the ceiling and carries springs Q and R side by side,
 * which carry the load. P feels the whole load, while Q and R share it, so
 * each of them stretches half as far. The load drops by the sum of P's
 * stretch and the pair's, which the rule reads off.
 */
export function SpringChainLab({
  description,
  labels,
  load: start,
  stiffness,
  title,
}: SpringChainLabProps) {
  const quantity = useQuantity();
  const [load, setLoad] = useState(start);
  const chain = springChain(stiffness, load);
  const most = springChain(stiffness, Math.max(start * 2, 10)).total * 100;

  return (
    <VisualCard
      onReset={() => {
        setLoad(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.load}</span>}
          max={Math.max(start * 2, 10)}
          min={0}
          name={labels.loadName}
          onValueChange={setLoad}
          readout={<InlineMath math={quantity(load, "\\text{ N}", 0)} />}
          step={1}
          value={load}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={springProgram}
          state={{ most, pair: chain.pair * 100, top: chain.top * 100 }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.top}
            value={
              <InlineMath math={quantity(chain.top * 100, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.pair}
            value={
              <InlineMath math={quantity(chain.pair * 100, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.total}
            value={
              <InlineMath
                math={quantity(chain.total * 100, "\\text{ cm}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
