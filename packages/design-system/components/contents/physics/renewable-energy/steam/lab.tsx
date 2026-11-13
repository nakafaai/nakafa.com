import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintGround,
  paintHills,
  paintSky,
  SCENERY,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
import {
  electricOutput,
  FUELS,
  type Fuel,
  FuelSchema,
  fuelPerHour,
  HEAT_INPUT,
  idealEfficiency,
  wasteHeat,
} from "@repo/design-system/components/contents/physics/renewable-energy/steam/cycle";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The colors of the heat in, the electricity out and the heat the condenser hands on. */
const FLOW_COLORS = {
  electric: PLOT_COLORS.orange,
  heat: PLOT_COLORS.amber,
  waste: PLOT_COLORS.pink,
} as const;

/** The glow of each heat source: flames for the fuels that burn, a violet glow in the reactor. */
const SOURCE_GLOW = {
  coal: mix(PLOT_COLORS.orange, PLOT_COLORS.amber, 0.3),
  gas: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.3),
  uranium: PLOT_COLORS.violet,
} as const satisfies Record<Fuel, string>;

/** What the sketch reads on every frame: the fuel that heats the boiler. */
interface SteamFrame {
  readonly fuel: Fuel;
}

/** The heat source under the boiler: a coal furnace and its heap, a gas burner, or a reactor vessel. */
function paintSource(
  sketch: p5,
  box: { height: number; width: number; x: number; y: number },
  fuel: Fuel,
  time: number
) {
  withShadow(
    sketch,
    { blur: 16, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      gradientRect(sketch, box, [
        [0, mix(SCENERY.concrete, getColor("WHITE"), 0.25)],
        [1, mix(SCENERY.concrete, getColor("BLACK"), 0.35)],
      ]);
    }
  );
  const glow = SOURCE_GLOW[fuel];
  const core = {
    height: box.height * 0.55,
    width: box.width * 0.7,
    x: box.x + box.width * 0.15,
    y: box.y + box.height * 0.3,
  };
  sketch.fill(getColor("ZINC", 950));
  sketch.rect(
    core.x,
    core.y,
    core.width,
    core.height,
    fuel === "uranium" ? core.width * 0.3 : 4
  );
  spotlight(
    sketch,
    { x: core.x + core.width / 2, y: core.y + core.height * 0.6 },
    core.width * 0.8,
    { color: glow, strength: 0.85 }
  );
  if (fuel !== "uranium") {
    for (let tongue = 0; tongue < 6; tongue += 1) {
      const flicker = 1 + Math.sin(time * 12 + tongue * 2.1) * 0.15;
      sketch.fill(fade(glow, 0.85));
      sketch.ellipse(
        core.x + core.width * (0.12 + tongue * 0.15),
        core.y + core.height * (0.75 - 0.2 * flicker),
        core.width * 0.1,
        core.height * 0.45 * flicker
      );
    }
  }
  if (fuel === "coal") {
    sketch.fill(mix(getColor("ZINC", 900), getColor("STONE", 600), 0.2));
    sketch.arc(
      box.x - box.width * 0.1,
      box.y + box.height,
      box.width * 0.9,
      box.height * 0.7,
      Math.PI,
      Math.PI * 2
    );
  }
  if (fuel === "gas") {
    sketch.fill(getColor("SLATE", 400));
    sketch.rect(0, box.y + box.height * 0.8, box.x, box.height * 0.08);
  }
}

/**
 * The steam cycle: steam from the boiler drives the turbine and generator,
 * the condenser takes the heat the turbine could not use and sends it to the
 * cooling tower, and the water is pumped back to the boiler.
 */
function paintCycle(sketch: p5, fuel: Fuel, time: number, ground: number) {
  const { height, width } = sketch;
  const drum = { x: width * 0.19, y: ground - height * 0.44 };
  const turbine = { x: width * 0.46, y: ground - height * 0.36 };
  const condenser = { x: width * 0.5, y: ground - height * 0.12 };
  const pipe = Math.max(height * 0.018, 5);
  sketch.stroke(getColor("SLATE", 200));
  sketch.strokeWeight(pipe);
  sketch.line(drum.x, drum.y, turbine.x, turbine.y);
  sketch.stroke(PLOT_COLORS.teal);
  sketch.line(condenser.x, condenser.y, drum.x, condenser.y);
  sketch.line(drum.x, condenser.y, drum.x, ground - height * 0.2);
  sketch.noStroke();
  sketch.fill(getColor("SLATE", 300));
  sketch.rect(
    drum.x - width * 0.06,
    drum.y - height * 0.04,
    width * 0.12,
    height * 0.08,
    height * 0.04
  );
  const blade = height * 0.11;
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 5 },
    () => {
      sketch.fill(getColor("SLATE", 400));
      sketch.quad(
        turbine.x,
        turbine.y - blade * 0.45,
        turbine.x + width * 0.12,
        turbine.y - blade,
        turbine.x + width * 0.12,
        turbine.y + blade,
        turbine.x,
        turbine.y + blade * 0.45
      );
    }
  );
  sketch.stroke(fade(getColor("ZINC", 900), 0.7));
  sketch.strokeWeight(2);
  for (let row = 0; row < 5; row += 1) {
    const x = turbine.x + width * 0.02 + row * width * 0.022;
    const offset = Math.sin(time * 8 + row) * blade * 0.2;
    sketch.line(
      x,
      turbine.y - blade * (0.4 + row * 0.1) + offset,
      x,
      turbine.y + blade * (0.4 + row * 0.1) + offset
    );
  }
  sketch.noStroke();
  gradientRect(
    sketch,
    {
      height: blade * 1.3,
      width: width * 0.09,
      x: turbine.x + width * 0.13,
      y: turbine.y - blade * 0.65,
    },
    [
      [0, mix(FLOW_COLORS.electric, getColor("WHITE"), 0.3)],
      [1, mix(FLOW_COLORS.electric, getColor("BLACK"), 0.3)],
    ]
  );
  sketch.fill(getColor("SLATE", 600));
  sketch.rect(
    condenser.x - width * 0.06,
    condenser.y - height * 0.05,
    width * 0.14,
    height * 0.1,
    4
  );
  const tower = { base: width * 0.12, x: width * 0.84 };
  sketch.fill(mix(SCENERY.concrete, getColor("WHITE"), 0.2));
  const waist = (share: number) =>
    tower.base * (0.5 - 0.3 * Math.sin(Math.PI * share * 0.85));
  sketch.beginShape();
  for (let step = 0; step <= 12; step += 1) {
    sketch.vertex(
      tower.x - waist(step / 12),
      ground - (step / 12) * height * 0.48
    );
  }
  for (let step = 12; step >= 0; step -= 1) {
    sketch.vertex(
      tower.x + waist(step / 12),
      ground - (step / 12) * height * 0.48
    );
  }
  sketch.endShape(sketch.CLOSE);
  sketch.stroke(fade(FLOW_COLORS.waste, 0.8));
  sketch.strokeWeight(pipe * 0.8);
  sketch.line(
    condenser.x + width * 0.08,
    condenser.y,
    tower.x - tower.base * 0.4,
    condenser.y
  );
  sketch.noStroke();
  const plume = wasteHeat(fuel) / HEAT_INPUT;
  for (let puff = 0; puff < 7; puff += 1) {
    const rise = (time * 0.12 + puff / 7) % 1;
    sketch.fill(fade(getColor("WHITE"), 0.55 * (1 - rise)));
    sketch.circle(
      tower.x + Math.sin(puff * 2 + time * 0.5) * 10 + rise * width * 0.05,
      ground - height * 0.5 - rise * height * 0.4,
      (tower.base * 0.5 + rise * tower.base) * plume * 1.4
    );
  }
  sketch.fill(fade(getColor("WHITE"), 0.85));
  for (let parcel = 0; parcel < 5; parcel += 1) {
    const along = (parcel / 5 + time * 0.4) % 1;
    sketch.circle(
      drum.x + (turbine.x - drum.x) * along,
      drum.y + (turbine.y - drum.y) * along,
      pipe * 0.7
    );
  }
}

/** Draws the plant: the chosen heat source, the shared steam cycle, and the cooling tower's plume. */
function steamProgram(sketch: p5, read: () => SteamFrame) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { fuel } = read();
    time += sketch.isLooping() ? Math.min(sketch.deltaTime / 1000, 0.1) : 0;
    const { height, width } = sketch;
    const ground = height * 0.86;
    paintSky(sketch, ground);
    paintHills(sketch, ground);
    paintGround(sketch, ground, SCENERY.grass);
    paintSource(
      sketch,
      {
        height: height * 0.36,
        width: width * 0.22,
        x: width * 0.08,
        y: ground - height * 0.36,
      },
      fuel,
      time
    );
    paintCycle(sketch, fuel, time, ground);
    vignette(sketch, 0.3);
  };
}

interface SteamPlantCycleLabProps {
  description: ReactNode;
  /** The fuel that heats the boiler first. */
  fuel?: Fuel;
  labels: {
    chooseFuel: string;
    electric: ReactNode;
    fuelUse: ReactNode;
    fuels: Record<Fuel, ReactNode>;
    heat: ReactNode;
    ideal: ReactNode;
    steam: ReactNode;
    viewLabel: string;
    waste: ReactNode;
  };
  title: ReactNode;
}

/**
 * A steam power plant fed 1000 MW of heat by coal, gas or uranium. The fuel
 * only changes how the heat is made; from the boiler on, the steam drives
 * the same turbine and generator, and the condenser hands most of the heat to
 * the cooling tower. Uranium's fission needs under a kilogram of fuel an hour
 * where coal needs 150 tonnes.
 */
export function SteamPlantCycleLab({
  description,
  fuel: initialFuel = "coal",
  labels,
  title,
}: SteamPlantCycleLabProps) {
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
          program={steamProgram}
          state={{ fuel }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={FLOW_COLORS.heat}
            label={labels.heat}
            value={
              <InlineMath math={measure(HEAT_INPUT / 1e6, "\\text{ MW}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={FLOW_COLORS.electric}
            label={labels.electric}
            value={
              <InlineMath
                math={measure(electricOutput(fuel) / 1e6, "\\text{ MW}", 0)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={FLOW_COLORS.waste}
            label={labels.waste}
            value={
              <InlineMath
                math={measure(wasteHeat(fuel) / 1e6, "\\text{ MW}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.steam}
            value={
              <InlineMath
                math={measure(FUELS[fuel].steam, "^\\circ\\text{C}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.ideal}
            value={
              <InlineMath
                math={measure(idealEfficiency(fuel) * 100, "\\%", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.fuelUse}
            value={
              <InlineMath
                math={measure(
                  fuelPerHour(fuel),
                  "\\text{ kg}",
                  fuelPerHour(fuel) < 10 ? 2 : 0
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
