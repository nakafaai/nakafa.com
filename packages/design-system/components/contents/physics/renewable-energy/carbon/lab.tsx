import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  carbonMass,
  dioxideMass,
  dioxidePerMegajoule,
  dioxideVolume,
  FUEL_MASS,
  type Fuel,
  FuelSchema,
  oxygenTaken,
} from "@repo/design-system/components/contents/physics/renewable-energy/carbon/combustion";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How long the burn lasts, in seconds of the run. */
const BURN_SECONDS = 6;

/** How long the finished burn rests before it starts again, in seconds. */
const HOLD_SECONDS = 1.5;

/** The heaviest mass the bars show, in kilograms. */
const BAR_TOP = 3.5;

/** The colors of the three masses: the fuel's carbon, the oxygen from the air, the carbon dioxide. */
const MASS_COLORS = {
  carbon: getColor("SLATE", 600),
  dioxide: PLOT_COLORS.violet,
  oxygen: PLOT_COLORS.teal,
} as const;

/** What the sketch reads on every frame: the fuel on the burner. */
interface CarbonFrame {
  readonly fuel: Fuel;
}

/** The burner with its shrinking fuel and flame, feeding gas up the hood into the balloon. */
function paintBurner(sketch: p5, fuel: Fuel, burnt: number, time: number) {
  const { height, width } = sketch;
  const bench = height * 0.84;
  const centre = width * 0.28;
  gradientRect(sketch, { height: height - bench, width, x: 0, y: bench }, [
    [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.25)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.6)],
  ]);
  const left = 1 - burnt;
  const lump = height * 0.12 * Math.cbrt(Math.max(left, 0.02));
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.6), drop: 4 },
    () => {
      litBall(sketch, { x: centre, y: bench - lump * 0.6 }, lump, {
        dark:
          fuel === "coal"
            ? MATERIAL.coalLump
            : mix(MATERIAL.dieselFuel, getColor("BLACK"), 0.5),
        light:
          fuel === "coal"
            ? mix(MATERIAL.coalLump, getColor("WHITE"), 0.3)
            : mix(MATERIAL.dieselFuel, getColor("WHITE"), 0.4),
      });
    }
  );
  if (burnt < 1) {
    spotlight(sketch, { x: centre, y: bench - lump * 1.6 }, height * 0.22, {
      color: MATERIAL.coalGlow,
      strength: 0.6,
    });
    for (let tongue = -1; tongue <= 1; tongue += 1) {
      const flicker = 1 + Math.sin(time * 13 + tongue * 2) * 0.15;
      sketch.fill(fade(MATERIAL.gasFlame, 0.85));
      sketch.ellipse(
        centre + tongue * lump * 0.5,
        bench - lump * 1.3 - height * 0.04 * flicker,
        lump * 0.45,
        height * 0.12 * flicker
      );
    }
  }
  sketch.fill(fade(getColor("SLATE", 300), 0.35));
  sketch.quad(
    centre - width * 0.1,
    height * 0.48,
    centre + width * 0.1,
    height * 0.48,
    centre + width * 0.03,
    height * 0.3,
    centre - width * 0.03,
    height * 0.3
  );
  sketch.stroke(fade(MASS_COLORS.oxygen, 0.8));
  sketch.strokeWeight(2);
  for (let gust = 0; gust < 3; gust += 1) {
    const along = (time * 0.6 + gust / 3) % 1;
    const x = centre - width * 0.22 + along * width * 0.14;
    sketch.line(
      x,
      bench - height * 0.08 - gust * 8,
      x + 16,
      bench - height * 0.08 - gust * 8
    );
  }
  sketch.noStroke();
}

/** The balloon that collects the carbon dioxide, as big as the gas it holds. */
function paintBalloon(sketch: p5, fuel: Fuel, burnt: number) {
  const { height, width } = sketch;
  const full = Math.cbrt(dioxideVolume(fuel) / dioxideVolume("diesel"));
  const radius = height * 0.15 * Math.max(full * Math.cbrt(burnt), 0.08);
  const centre = { x: width * 0.28, y: height * 0.18 };
  sketch.stroke(getColor("SLATE", 300));
  sketch.strokeWeight(3);
  sketch.line(centre.x, height * 0.3, centre.x, centre.y + radius * 0.9);
  sketch.noStroke();
  withShadow(
    sketch,
    { blur: 18, color: fade(getColor("BLACK"), 0.45), drop: 8 },
    () => {
      litBall(sketch, centre, radius, {
        dark: fade(mix(MASS_COLORS.dioxide, getColor("BLACK"), 0.35), 0.85),
        light: fade(mix(MASS_COLORS.dioxide, getColor("WHITE"), 0.55), 0.85),
      });
    }
  );
}

/**
 * The mass bars: the fuel's carbon plus the oxygen from the air stacks up to
 * the carbon dioxide beside it, each growing as the fuel burns, against a
 * dashed line at the 1 kg of fuel.
 */
function paintMasses(sketch: p5, fuel: Fuel, burnt: number) {
  const { height, width } = sketch;
  const base = height * 0.8;
  const scale = (height * 0.62) / BAR_TOP;
  const slot = width * 0.1;
  const left = width * 0.6;
  sketch.fill(fade(getColor("ZINC", 950), 0.35));
  sketch.rect(
    left - slot * 0.5,
    base - BAR_TOP * scale - 12,
    slot * 3.4,
    BAR_TOP * scale + 24,
    8
  );
  const carbon = carbonMass(fuel) * burnt * scale;
  const oxygen = oxygenTaken(fuel) * burnt * scale;
  gradientRect(
    sketch,
    { height: carbon, width: slot, x: left, y: base - carbon },
    [
      [0, mix(MASS_COLORS.carbon, getColor("WHITE"), 0.25)],
      [1, MASS_COLORS.carbon],
    ]
  );
  gradientRect(
    sketch,
    { height: oxygen, width: slot, x: left, y: base - carbon - oxygen },
    [
      [0, mix(MASS_COLORS.oxygen, getColor("WHITE"), 0.25)],
      [1, MASS_COLORS.oxygen],
    ]
  );
  const dioxide = dioxideMass(fuel) * burnt * scale;
  gradientRect(
    sketch,
    { height: dioxide, width: slot, x: left + slot * 1.6, y: base - dioxide },
    [
      [0, mix(MASS_COLORS.dioxide, getColor("WHITE"), 0.25)],
      [1, MASS_COLORS.dioxide],
    ]
  );
  dashed(
    sketch,
    { x: left - slot * 0.3, y: base - FUEL_MASS * scale },
    { x: left + slot * 2.8, y: base - FUEL_MASS * scale },
    { color: fade(getColor("WHITE"), 0.85), dash: 5, weight: 1.5 }
  );
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(1);
  sketch.line(left - slot * 0.3, base, left + slot * 2.8, base);
  sketch.noStroke();
}

/** Draws the burn: the fuel shrinks, the balloon fills, and the mass bars grow to their final values. */
function carbonProgram(sketch: p5, read: () => CarbonFrame) {
  let time = 0;
  let flames = 0;
  let shown: Fuel | undefined;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { fuel } = read();
    if (shown !== fuel) {
      shown = fuel;
      time = sketch.isLooping() ? 0 : BURN_SECONDS;
    }
    if (sketch.isLooping()) {
      const elapsed = sketch.deltaTime / 1000;
      time = advanceRun(time, elapsed, {
        duration: BURN_SECONDS,
        hold: HOLD_SECONDS,
        rate: 1,
      });
      flames += Math.min(elapsed, 0.1);
    }
    const burnt = shownTime(time, BURN_SECONDS) / BURN_SECONDS;
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, getColor("SLATE", 700)],
      [1, mix(getColor("SLATE", 700), getColor("SLATE", 400), 0.3)],
    ]);
    spotlight(sketch, { x: width * 0.3, y: height * 0.4 }, width * 0.5, {
      color: MATERIAL.sunDisc,
      strength: 0.2,
    });
    paintBurner(sketch, fuel, burnt, flames);
    paintBalloon(sketch, fuel, burnt);
    paintMasses(sketch, fuel, burnt);
    vignette(sketch, 0.35);
  };
}

interface FuelCombustionCarbonLabProps {
  description: ReactNode;
  /** The fuel on the burner first. */
  fuel?: Fuel;
  labels: {
    carbon: ReactNode;
    chooseFuel: string;
    dioxide: ReactNode;
    fuels: Record<Fuel, ReactNode>;
    oxygen: ReactNode;
    perEnergy: ReactNode;
    viewLabel: string;
    volume: ReactNode;
  };
  title: ReactNode;
}

/**
 * 1 kg of coal, diesel or methane burns under a hood, and a balloon collects
 * the carbon dioxide. The bars show where its mass comes from: the fuel's
 * carbon plus oxygen taken from the air, so the gas weighs well over the
 * 1 kg of fuel that burned.
 */
export function FuelCombustionCarbonLab({
  description,
  fuel: initialFuel = "coal",
  labels,
  title,
}: FuelCombustionCarbonLabProps) {
  const [fuel, setFuel] = useState<Fuel>(initialFuel);
  const measure = useQuantity();
  const isFuel = Schema.is(FuelSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFuel}
          gridColumns="3"
          onValueChange={(value) => {
            if (isFuel(value)) {
              setFuel(value);
            }
          }}
          type="single"
          value={fuel}
          variant="outline"
        >
          {Arr.map(FuelSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.fuels[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={carbonProgram}
          state={{ fuel }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={MASS_COLORS.carbon}
            label={labels.carbon}
            value={
              <InlineMath math={measure(carbonMass(fuel), "\\text{ kg}", 2)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={MASS_COLORS.oxygen}
            label={labels.oxygen}
            value={
              <InlineMath math={measure(oxygenTaken(fuel), "\\text{ kg}", 2)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={MASS_COLORS.dioxide}
            label={labels.dioxide}
            value={
              <InlineMath math={measure(dioxideMass(fuel), "\\text{ kg}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.volume}
            value={
              <InlineMath
                math={measure(dioxideVolume(fuel), "\\text{ m}^3", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.perEnergy}
            value={
              <InlineMath
                math={measure(dioxidePerMegajoule(fuel), "\\text{ g/MJ}", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
