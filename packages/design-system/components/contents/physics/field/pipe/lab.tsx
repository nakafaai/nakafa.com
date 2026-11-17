import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  arrow,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  fallThrough,
  fallTime,
} from "@repo/design-system/components/contents/physics/field/magnet";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Gravity, in m s⁻². */
const GRAVITY = 9.8;

/** The length of each pipe, in metres. */
const PIPE = 1;

/**
 * The eddy-current drag per unit mass in each pipe, in s⁻¹. These are an
 * illustration, chosen so a strong magnet takes about five seconds through a
 * metre of thick copper, as classroom demonstrations show: the plastic pipe
 * carries no current, and the slit breaks the loops round the copper pipe,
 * leaving only weak currents.
 */
const DRAG = { copper: 50, plastic: 0, slit: 6 } as const;

/** The pipes, left to right. */
const PIPES = ["plastic", "copper", "slit"] as const;

/** What the sketch reads on every frame. */
const PipeFrameSchema = Schema.Struct({ longest: Schema.Finite });
type PipeFrame = typeof PipeFrameSchema.Type;

/** Wall seconds the scene holds after the slowest magnet lands, before all three drop again. */
const HOLD_SECONDS = 1.5;

/**
 * Draws one moment: three vertical pipes of the same size, plastic, copper,
 * and copper with a slit along it, each with a magnet released at the same
 * moment and falling at the pace its eddy-current drag allows. Round the
 * magnet in the copper pipe, the induced current circles one way in the ring
 * below it and the other way in the ring above it.
 */
function pipeProgram(sketch: p5, read: () => PipeFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1)) %
        (frame.longest + HOLD_SECONDS);
    }
    const { height, width } = sketch;
    const floor = height * 0.92;
    paintBench(sketch, floor);
    const top = height * 0.08;
    const metre = floor - top - height * 0.04;
    Arr.forEach(PIPES, (pipe, index) => {
      const x = width * (0.22 + index * 0.28);
      const half = width * 0.06;
      const color =
        pipe === "plastic" ? BENCH_COLORS.glass : INSTRUMENT_COLORS.copper;
      gradientRect(
        sketch,
        { height: metre, width: half * 2, x: x - half, y: top },
        [
          [
            0,
            fade(
              mix(color, getColor("WHITE"), 0.25),
              pipe === "plastic" ? 0.3 : 0.85
            ),
          ],
          [0.5, fade(color, pipe === "plastic" ? 0.15 : 0.6)],
          [
            1,
            fade(
              mix(color, getColor("BLACK"), 0.45),
              pipe === "plastic" ? 0.3 : 0.9
            ),
          ],
        ],
        true
      );
      if (pipe === "slit") {
        sketch.stroke(getColor("ZINC", 950));
        sketch.strokeWeight(3);
        sketch.line(x, top, x, top + metre);
      }
      const fallen = Math.min(
        fallThrough(DRAG[pipe], GRAVITY, clock).distance,
        PIPE
      );
      const y = top + (fallen / PIPE) * metre;
      sketch.noStroke();
      sketch.fill(MACHINE_COLORS.signalRed);
      sketch.rect(x - half * 0.7, y - 14, half * 1.4, 14, 3);
      sketch.fill(INSTRUMENT_COLORS.trolleyPaint);
      sketch.rect(x - half * 0.7, y, half * 1.4, 14, 3);
      if (pipe === "copper" && fallen < PIPE) {
        sketch.noFill();
        sketch.stroke(PLOT_COLORS.amber);
        sketch.strokeWeight(2);
        sketch.ellipse(x, y - 30, half * 2.4, 12);
        sketch.ellipse(x, y + 30, half * 2.4, 12);
        arrow(
          sketch,
          { x: x - 6, y: y - 24 },
          { x: x + 8, y: y - 24 },
          { color: PLOT_COLORS.amber, head: 8, weight: 2 }
        );
        arrow(
          sketch,
          { x: x + 6, y: y + 36 },
          { x: x - 8, y: y + 36 },
          { color: PLOT_COLORS.amber, head: 8, weight: 2 }
        );
      }
      caption(
        sketch,
        `${index + 1}`,
        { x, y: top - 6 },
        {
          align: "center",
          baseline: "bottom",
          color: getColor("WHITE"),
          size: 13,
        }
      );
    });
    vignette(sketch, 0.3);
  };
}

interface MagnetPipeLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    copper: ReactNode;
    plastic: ReactNode;
    slit: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * The same strong magnet dropped at the same moment through three pipes of
 * the same size: plastic, copper, and copper with a slit along its length.
 * In the copper pipe the falling magnet drives eddy currents round the pipe,
 * whose field opposes its motion, so it drifts down slowly; the slit cuts
 * those loops and the plastic carries none, so there it falls faster or
 * freely. The facts give each fall time through one metre.
 */
export function MagnetPipeLab({
  description,
  labels,
  title,
}: MagnetPipeLabProps) {
  const quantity = useQuantity();
  const times = {
    copper: fallTime(DRAG.copper, GRAVITY, PIPE),
    plastic: fallTime(DRAG.plastic, GRAVITY, PIPE),
    slit: fallTime(DRAG.slit, GRAVITY, PIPE),
  };

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={pipeProgram}
          state={{ longest: times.copper }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={<>1. {labels.plastic}</>}
            value={
              <InlineMath math={quantity(times.plastic, "\\text{ s}", 2)} />
            }
          />
          <VisualFactTabular
            label={<>2. {labels.copper}</>}
            value={
              <InlineMath math={quantity(times.copper, "\\text{ s}", 1)} />
            }
          />
          <VisualFactTabular
            label={<>3. {labels.slit}</>}
            value={<InlineMath math={quantity(times.slit, "\\text{ s}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
