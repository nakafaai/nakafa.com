import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { fissionEnergy } from "@repo/design-system/components/contents/physics/nuclear/decay";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds one fission plays over. */
const PLAY_SECONDS = 4;

/** Wall seconds the products hold before the fission plays again. */
const HOLD_SECONDS = 2;

/** What the sketch reads on every frame. */
const FissionFrameSchema = Schema.Struct({
  after: Schema.Finite,
  before: Schema.Finite,
  neutrons: Schema.Finite,
  readings: Schema.Array(Schema.String),
});
type FissionFrame = typeof FissionFrameSchema.Type;

/** A nucleus at `at`, drawn as a cluster of protons and neutrons `size` pixels across. */
function nucleus(
  sketch: p5,
  at: { readonly x: number; readonly y: number },
  size: number,
  seed: number
) {
  const count = Math.round(size / 3);
  Arr.forEach(
    Arr.makeBy(count, (index) => index),
    (index) => {
      const angle = hashUnit(index, seed) * Math.PI * 2;
      const reach = Math.sqrt(hashUnit(index, seed + 1)) * size * 0.4;
      const proton = index % 2 === 0;
      litBall(
        sketch,
        {
          x: at.x + Math.cos(angle) * reach,
          y: at.y + Math.sin(angle) * reach,
        },
        size * 0.12,
        {
          dark: mix(
            proton ? MACHINE_COLORS.signalRed : ENERGY_COLORS.galvanizedSteel,
            getColor("BLACK"),
            0.4
          ),
          light: mix(
            proton ? MACHINE_COLORS.signalRed : ENERGY_COLORS.galvanizedSteel,
            getColor("WHITE"),
            0.3
          ),
        }
      );
    }
  );
}

/**
 * Draws one moment of the fission: a slow neutron reaches the uranium
 * nucleus, the nucleus splits into two fragments, and the released neutrons
 * fly off. Two bars below compare the total mass before and after, the
 * after bar short by the mass defect, with each total written beside it.
 */
function fissionProgram(sketch: p5, read: () => FissionFrame) {
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
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, ENERGY_COLORS.nightSky],
      [1, getColor("ZINC", 950)],
    ]);
    const centre = { x: width * 0.5, y: height * 0.34 };
    const size = Math.min(width, height) * 0.22;
    const hit = 0.35;
    if (t < hit) {
      const approach = t / hit;
      litBall(
        sketch,
        {
          x: width * 0.06 + (centre.x - size * 0.5 - width * 0.06) * approach,
          y: centre.y,
        },
        size * 0.08,
        {
          dark: mix(ENERGY_COLORS.galvanizedSteel, getColor("BLACK"), 0.4),
          light: getColor("WHITE"),
        }
      );
      nucleus(sketch, centre, size, 1);
    } else {
      const spread = (t - hit) / (1 - hit);
      nucleus(
        sketch,
        {
          x: centre.x - spread * width * 0.28,
          y: centre.y - spread * height * 0.08,
        },
        size * 0.78,
        3
      );
      nucleus(
        sketch,
        {
          x: centre.x + spread * width * 0.28,
          y: centre.y + spread * height * 0.06,
        },
        size * 0.66,
        5
      );
      Arr.forEach(
        Arr.makeBy(frame.neutrons, (index) => index),
        (index) => {
          const angle = -Math.PI / 2 + (index - (frame.neutrons - 1) / 2) * 0.9;
          litBall(
            sketch,
            {
              x: centre.x + Math.cos(angle) * spread * width * 0.4,
              y: centre.y + Math.sin(angle) * spread * height * 0.3,
            },
            size * 0.08,
            {
              dark: mix(ENERGY_COLORS.galvanizedSteel, getColor("BLACK"), 0.4),
              light: getColor("WHITE"),
            }
          );
        }
      );
      sketch.noStroke();
      sketch.fill(fade(ENERGY_COLORS.reactorGlow, 0.35 * (1 - spread)));
      sketch.circle(centre.x, centre.y, size * 2.5 * spread);
    }
    const bars = { left: width * 0.12, right: width * 0.88, top: height * 0.7 };
    const floor = frame.after - (frame.before - frame.after) * 2.5;
    const share = (mass: number) => (mass - floor) / (frame.before - floor);
    Arr.forEach(
      [
        { color: PLOT_COLORS.violet, mass: frame.before },
        { color: PLOT_COLORS.teal, mass: frame.after },
      ],
      (bar, index) => {
        const y = bars.top + index * height * 0.11;
        sketch.noStroke();
        sketch.fill(fade(getColor("WHITE"), 0.1));
        sketch.rect(bars.left, y, bars.right - bars.left, height * 0.07, 4);
        sketch.fill(bar.color);
        sketch.rect(
          bars.left,
          y,
          (bars.right - bars.left) * share(bar.mass),
          height * 0.07,
          4
        );
        caption(
          sketch,
          frame.readings[index] ?? "",
          { x: bars.left + 8, y: y + height * 0.035 },
          {
            align: "left",
            baseline: "middle",
            color: getColor("WHITE"),
            size: 13,
          }
        );
      }
    );
    vignette(sketch, 0.3);
  };
}

interface FissionLabProps {
  description: NonNullable<ReactNode>;
  /** The masses of the two fission fragments, in atomic mass units. */
  fragments: readonly [number, number];
  labels: {
    defect: ReactNode;
    energy: ReactNode;
    kilograms: ReactNode;
    viewLabel: string;
  };
  /** The speed of light, in m s⁻¹. */
  lightSpeed: number;
  /** The mass of one neutron, in atomic mass units. */
  neutron: number;
  /** The mass of the nucleus that splits, in atomic mass units. */
  parent: number;
  /** How many neutrons the fission releases. */
  released: number;
  title: NonNullable<ReactNode>;
  /** One atomic mass unit, in kilograms. */
  unit: number;
}

/**
 * A slow neutron splits a uranium nucleus into two fragments and a few fast
 * neutrons. The bars weigh everything before and after: the products are a
 * little lighter, and that mass defect is the energy the fission releases,
 * E = Δm c². The bars start just below the lighter total, so the tiny
 * defect shows.
 */
export function FissionLab({
  description,
  fragments,
  labels,
  lightSpeed,
  neutron,
  parent,
  released,
  title,
  unit,
}: FissionLabProps) {
  const quantity = useQuantity();
  const reading = useReading();
  const fission = fissionEnergy(
    {
      after: [...fragments, ...Arr.makeBy(released, () => neutron)],
      before: [parent, neutron],
    },
    { atomic: unit, light: lightSpeed }
  );
  const exponent = Math.floor(Math.log10(fission.energy));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={fissionProgram}
          state={{
            after: fission.after,
            before: fission.before,
            neutrons: released,
            readings: [
              `${reading(fission.before, 4)} u`,
              `${reading(fission.after, 4)} u`,
            ],
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.defect}
            value={
              <InlineMath math={quantity(fission.defect, "\\text{ u}", 4)} />
            }
          />
          <VisualFactTabular
            label={labels.kilograms}
            value={
              <InlineMath
                math={`${quantity(fission.kilograms / 10 ** Math.floor(Math.log10(fission.kilograms)), "", 2)}\\times10^{${Math.floor(Math.log10(fission.kilograms))}}\\text{ kg}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath
                math={`${quantity(fission.energy / 10 ** exponent, "", 2)}\\times10^{${exponent}}\\text{ J}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
