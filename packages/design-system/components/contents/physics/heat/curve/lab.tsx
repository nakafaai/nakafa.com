import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  dashed,
  fade,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintBeaker,
  paintBench,
  paintThermometer,
} from "@repo/design-system/components/contents/physics/heat/glass";
import { latentFromHeating } from "@repo/design-system/components/contents/physics/heat/thermal";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
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
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the whole heating plays over, then holds its last frame. */
const PLAY_SECONDS = 8;

/** Wall seconds the last frame holds before the heating starts over. */
const HOLD_SECONDS = 2;

/** How many temperature readings the lab prepares along the heating. */
const STEPS = 60;

/** What the sketch reads on every frame: the two stretches in minutes, the temperatures, and the prepared readings. */
const CurveFrameSchema = Schema.Struct({
  melt: Schema.Finite,
  melting: Schema.Finite,
  readings: Schema.Array(Schema.String),
  top: Schema.Finite,
  warm: Schema.Finite,
});
type CurveFrame = typeof CurveFrameSchema.Type;

/** The temperature a fraction `t` of the way through the whole heating. */
function temperatureAt(frame: CurveFrame, t: number) {
  const minutes = t * (frame.melt + frame.warm);
  return minutes <= frame.melt
    ? frame.melting
    : frame.melting +
        ((frame.top - frame.melting) * (minutes - frame.melt)) / frame.warm;
}

/**
 * Draws one moment of the heating: the beaker with its immersion heater, the
 * solid turning to liquid as the melting runs, the thermometer, and the
 * temperature against time drawn as far as the heating has got, with its
 * flat stretch while the solid melts.
 */
function curveProgram(sketch: p5, read: () => CurveFrame) {
  // The first frame is the finished state, so a paused card still shows the whole result.
  let clock = PLAY_SECONDS;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1)) %
        (PLAY_SECONDS + HOLD_SECONDS);
    }
    const t = Math.min(clock / PLAY_SECONDS, 1);
    const { height, width } = sketch;
    const top = height * 0.86;
    paintBench(sketch, top);
    const melted = Math.min((t * (frame.melt + frame.warm)) / frame.melt, 1);
    const beaker = {
      height: height * 0.38,
      width: width * 0.24,
      x: width * 0.06,
      y: top - height * 0.38,
    };
    paintBeaker(
      sketch,
      beaker,
      0.6,
      mix(MACHINE_COLORS.cotton, REAGENT_COLORS.vinegar, melted)
    );
    sketch.noStroke();
    sketch.fill(fade(MACHINE_COLORS.cotton, 0.85 * (1 - melted)));
    sketch.rect(
      beaker.x + 4,
      beaker.y + beaker.height * 0.4,
      beaker.width - 8,
      beaker.height * 0.6 - 4,
      3
    );
    sketch.fill(CAR_COLORS.castIron);
    sketch.rect(
      beaker.x + beaker.width * 0.3,
      beaker.y - height * 0.08,
      6,
      beaker.height * 0.9
    );
    sketch.fill(BENCH_COLORS.coalGlow);
    sketch.rect(
      beaker.x + beaker.width * 0.3 - 2,
      beaker.y + beaker.height * 0.62,
      10,
      beaker.height * 0.24,
      4
    );
    const temperature = temperatureAt(frame, t);
    paintThermometer(
      sketch,
      {
        bottom: {
          x: beaker.x + beaker.width * 0.75,
          y: beaker.y + beaker.height * 0.85,
        },
        label: beaker.x + beaker.width + 14,
        top: beaker.y - height * 0.16,
      },
      {
        high: frame.top + 10,
        low: frame.melting - 30,
        reading: frame.readings[Math.round(t * STEPS)] ?? "",
        temperature,
      }
    );
    const graph = {
      bottom: top - height * 0.06,
      left: width * 0.6,
      right: width * 0.94,
      top: height * 0.1,
    };
    const x = (share: number) =>
      graph.left + share * (graph.right - graph.left);
    const y = (celsius: number) =>
      graph.bottom -
      ((celsius - (frame.melting - 10)) / (frame.top - frame.melting + 20)) *
        (graph.bottom - graph.top);
    sketch.noStroke();
    sketch.fill(fade(getColor("ZINC", 950), 0.7));
    sketch.rect(
      graph.left - 26,
      graph.top - 14,
      graph.right - graph.left + 40,
      graph.bottom - graph.top + 34,
      8
    );
    sketch.stroke(fade(getColor("WHITE"), 0.7));
    sketch.strokeWeight(1.5);
    sketch.line(graph.left, graph.bottom, graph.right, graph.bottom);
    sketch.line(graph.left, graph.bottom, graph.left, graph.top);
    const samples = Arr.makeBy(Math.round(t * 200) + 1, (index) => index / 200);
    sketch.stroke(PLOT_COLORS.pink);
    sketch.strokeWeight(3);
    for (const [a, b] of Arr.zip(samples, Arr.drop(samples, 1))) {
      sketch.line(
        x(a),
        y(temperatureAt(frame, a)),
        x(b),
        y(temperatureAt(frame, b))
      );
    }
    const split = frame.melt / (frame.melt + frame.warm);
    dashed(
      sketch,
      { x: x(split), y: graph.bottom },
      { x: x(split), y: y(frame.melting) },
      {
        color: fade(getColor("WHITE"), 0.45),
        dash: 4,
        weight: 1,
      }
    );
    const axis = { color: fade(getColor("WHITE"), 0.85), size: 12 } as const;
    caption(
      sketch,
      "θ",
      { x: graph.left - 10, y: graph.top + 4 },
      { ...axis, align: "right", baseline: "middle" }
    );
    caption(
      sketch,
      "t",
      { x: graph.right, y: graph.bottom + 6 },
      { ...axis, align: "center", baseline: "top" }
    );
    vignette(sketch, 0.3);
  };
}

interface HeatingCurveLabProps {
  description: NonNullable<ReactNode>;
  /** The temperature the liquid reaches, in degrees Celsius. */
  finalTemperature: number;
  labels: {
    latent: ReactNode;
    power: ReactNode;
    viewLabel: string;
  };
  /** The specific heat capacity of the liquid, in J kg⁻¹ °C⁻¹. */
  liquidHeat: number;
  /** The mass of the sample, in kilograms. */
  mass: number;
  /** The melting point, in degrees Celsius. */
  meltingPoint: number;
  /** How long the solid takes to melt, in minutes. */
  meltMinutes: number;
  title: NonNullable<ReactNode>;
  /** How long the liquid takes to warm from the melting point to the final temperature, in minutes. */
  warmMinutes: number;
}

/**
 * An immersion heater of constant power melts a solid in a beaker and then
 * warms the liquid. While the solid melts the thermometer stays put and the
 * graph runs flat; once it has all melted the temperature climbs. The same
 * heater works through both stretches, so the warming stretch gives the
 * power, and the power times the melting time gives the latent heat.
 */
export function HeatingCurveLab({
  description,
  finalTemperature,
  labels,
  liquidHeat,
  mass,
  meltMinutes,
  meltingPoint,
  title,
  warmMinutes,
}: HeatingCurveLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const sample = latentFromHeating({
    mass,
    melt: meltMinutes * 60,
    rise: finalTemperature - meltingPoint,
    specific: liquidHeat,
    warm: warmMinutes * 60,
  });
  const frame = {
    melt: meltMinutes,
    melting: meltingPoint,
    readings: [],
    top: finalTemperature,
    warm: warmMinutes,
  };
  const readings = Arr.makeBy(
    STEPS + 1,
    (step) => `${reading(temperatureAt(frame, step / STEPS), 1)} °C`
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={curveProgram}
          state={{ ...frame, readings }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={quantity(sample.power, "\\text{ W}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.latent}
            value={
              <InlineMath
                math={`${quantity(sample.latent / 10 ** Math.floor(Math.log10(sample.latent)), "", 2)}\\times10^{${Math.floor(Math.log10(sample.latent))}}\\text{ J kg}^{-1}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
