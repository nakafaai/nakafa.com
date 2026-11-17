import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintBench,
  paintThermometer,
} from "@repo/design-system/components/contents/physics/heat/glass";
import { meltIce } from "@repo/design-system/components/contents/physics/heat/thermal";
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
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { TOWN_COLORS } from "@repo/design-system/lib/material/town";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the mixing plays over, then holds at its final state. */
const PLAY_SECONDS = 7;

/** Wall seconds the final state holds before the mixing starts over. */
const HOLD_SECONDS = 2.5;

/** What the sketch reads on every frame. */
const IceFrameSchema = Schema.Struct({
  final: Schema.Finite,
  given: Schema.Finite,
  melt: Schema.Finite,
  meltedShare: Schema.Finite,
  readings: Schema.Array(Schema.String),
  start: Schema.Finite,
  waterShare: Schema.Finite,
});
type IceFrame = typeof IceFrameSchema.Type;

/** How many temperature readings the lab prepares between the start and the end. */
const STEPS = 40;

/**
 * Draws one moment of the mixing: the insulated cup with its water, the ice
 * cube shrinking as it melts, the thermometer falling to the final
 * temperature, and two bars that compare the heat the water gives out with
 * the heat the ice takes in.
 */
function iceProgram(sketch: p5, read: () => IceFrame) {
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
    const progress = Math.min(clock / PLAY_SECONDS, 1);
    const eased = 1 - (1 - progress) ** 2;
    const { height, width } = sketch;
    const top = height * 0.8;
    paintBench(sketch, top);
    const cup = {
      height: height * 0.5,
      width: width * 0.3,
      x: width * 0.08,
      y: top - height * 0.5,
    };
    gradientRect(
      sketch,
      {
        height: cup.height + 10,
        width: cup.width + 20,
        x: cup.x - 10,
        y: cup.y - 4,
      },
      [
        [0, REAGENT_COLORS.foam],
        [1, mix(REAGENT_COLORS.foam, getColor("BLACK"), 0.2)],
      ]
    );
    const level = cup.y + cup.height * (1 - 0.72 * frame.waterShare - 0.18);
    gradientRect(
      sketch,
      {
        height: cup.y + cup.height - level,
        width: cup.width,
        x: cup.x,
        y: level,
      },
      [
        [0, fade(ENERGY_COLORS.kettleWater, 0.85)],
        [1, fade(mix(ENERGY_COLORS.kettleWater, TOWN_COLORS.water, 0.5), 0.95)],
      ]
    );
    const left = 1 - frame.meltedShare * eased;
    const side = cup.width * 0.36 * Math.cbrt(Math.max(left, 0));
    if (side > 1) {
      sketch.noStroke();
      sketch.fill(fade(ROAD_COLORS.ice, 0.9));
      sketch.rect(
        cup.x + cup.width * 0.5 - side / 2,
        level - side * 0.35,
        side,
        side,
        side * 0.15
      );
      sketch.fill(fade(ROAD_COLORS.icePolish, 0.7));
      sketch.rect(
        cup.x + cup.width * 0.5 - side / 2 + 3,
        level - side * 0.35 + 3,
        side * 0.3,
        side * 0.3,
        3
      );
    }
    const index = Math.round(eased * STEPS);
    const temperature = frame.start + (frame.final - frame.start) * eased;
    paintThermometer(
      sketch,
      {
        bottom: { x: cup.x + cup.width * 0.82, y: cup.y + cup.height * 0.88 },
        label: cup.x + cup.width + 14,
        top: cup.y - height * 0.12,
      },
      {
        high: Math.max(40, frame.start + 5),
        low: -5,
        reading: frame.readings[index] ?? "",
        temperature,
      }
    );
    const most = Math.max(frame.given, frame.melt);
    const barLeft = width * 0.66;
    const barWidth = width * 0.1;
    const tall = height * 0.5;
    const bars = [
      { color: PLOT_COLORS.pink, share: frame.given / most, x: barLeft },
      {
        color: PLOT_COLORS.teal,
        share: frame.melt / most,
        x: barLeft + barWidth * 1.5,
      },
    ];
    Arr.forEach(bars, (bar) => {
      sketch.noStroke();
      sketch.fill(fade(getColor("WHITE"), 0.12));
      sketch.rect(bar.x, top - tall, barWidth, tall, 4);
      sketch.fill(bar.color);
      sketch.rect(bar.x, top - tall * bar.share, barWidth, tall * bar.share, 4);
    });
    const label = {
      align: "center",
      baseline: "top",
      color: fade(getColor("WHITE"), 0.9),
      size: 12,
    } as const;
    caption(sketch, "Q₁", { x: barLeft + barWidth / 2, y: top + 6 }, label);
    caption(sketch, "Q₂", { x: barLeft + barWidth * 2, y: top + 6 }, label);
    vignette(sketch, 0.3);
  };
}

interface IceMeltingLabProps {
  description: NonNullable<ReactNode>;
  /** The mass of ice at its melting point, in grams. */
  iceMass: number;
  labels: {
    final: ReactNode;
    given: ReactNode;
    melt: ReactNode;
    viewLabel: string;
  };
  /** The specific latent heat of fusion of ice, in J kg⁻¹. */
  latentHeat: number;
  /** The specific heat capacity of water, in J kg⁻¹ °C⁻¹. */
  specificHeat: number;
  title: NonNullable<ReactNode>;
  /** The mass of warm water, in grams. */
  waterMass: number;
  /** The starting temperature of the water, in degrees Celsius. */
  waterTemperature: number;
}

/**
 * An ice cube at 0 °C dropped into warm water in an insulated cup. The water
 * cools and gives out heat Q₁; the ice takes in Q₂ to melt and then to warm
 * up. Watch the cube shrink and the thermometer fall to the temperature where
 * the two bars stand equal, the heat given out matching the heat taken in.
 */
export function IceMeltingLab({
  description,
  iceMass,
  labels,
  latentHeat,
  specificHeat,
  title,
  waterMass,
  waterTemperature,
}: IceMeltingLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const mixture = meltIce({
    ice: iceMass / 1000,
    latent: latentHeat,
    specific: specificHeat,
    temperature: waterTemperature,
    water: waterMass / 1000,
  });
  const taken = mixture.melt + mixture.melted * specificHeat * mixture.final;
  const cooled =
    (waterMass / 1000) * specificHeat * (waterTemperature - mixture.final);
  const readings = Arr.makeBy(
    STEPS + 1,
    (step) =>
      `${reading(waterTemperature + ((mixture.final - waterTemperature) * step) / STEPS, 1)} °C`
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={iceProgram}
          state={{
            final: mixture.final,
            given: cooled,
            melt: taken,
            meltedShare: mixture.melted / (iceMass / 1000),
            readings,
            start: waterTemperature,
            waterShare: waterMass / (waterMass + iceMass),
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.melt}
            value={
              <InlineMath math={quantity(mixture.melt, "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.given}
            value={
              <InlineMath math={quantity(mixture.given, "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.final}
            value={
              <InlineMath
                math={quantity(mixture.final, "^\\circ\\text{C}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
