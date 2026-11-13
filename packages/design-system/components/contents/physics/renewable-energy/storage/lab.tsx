import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintHills,
  paintSky,
  paintSun,
  SCENERY,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
import {
  BATTERY_SIZES,
  demand,
  demandEnergy,
  SOLAR_PEAK,
  STEP,
  solarEnergy,
  solarPower,
  storageDay,
} from "@repo/design-system/components/contents/physics/renewable-energy/storage/battery";
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
import { type ReactNode, useMemo, useState } from "react";

/** How many wall seconds a whole day plays in. */
const DAY_SECONDS = 12;

/** The colors of sunlight, demand and the battery's charge, shared by the chart and the facts. */
const SOLAR = PLOT_COLORS.amber;
const DEMAND = PLOT_COLORS.pink;
const CHARGE = PLOT_COLORS.teal;

/** The battery sizes as a Schema, for the toggle's values. */
const SizeSchema = Schema.Literals(["5", "10", "15"]);

/** What the sketch reads on every frame: the battery's size and its charge through the day. */
interface StorageFrame {
  readonly charges: readonly number[];
  readonly size: number;
}

/** The charge at `hour` through the settled day, in kilowatt-hours. */
function chargeAt(charges: readonly number[], hour: number) {
  return Arr.getUnsafe(
    charges,
    Math.min(Math.max(Math.floor(hour / STEP), 0), charges.length - 1)
  );
}

/** The health post with its roof panels and battery cabinet, lit while the battery or the sun can supply it. */
function paintPost(
  sketch: p5,
  hour: number,
  charge: number,
  size: number,
  ground: number
) {
  const { height, width } = sketch;
  const light = Math.max(Math.sin(((hour - 6) / 12) * Math.PI), 0);
  paintSky(sketch, ground, light > 0.1 ? "day" : "night");
  gradientRect(sketch, { height: ground, width, x: 0, y: 0 }, [
    [0, fade(getColor("ZINC", 950), 0.8 * (1 - light))],
    [1, fade(getColor("ZINC", 950), 0.5 * (1 - light))],
  ]);
  if (light > 0) {
    paintSun(
      sketch,
      {
        x: width * (0.08 + ((hour - 6) / 12) * 0.84),
        y: ground - light * ground * 0.8,
      },
      Math.max(height * 0.03, 8),
      light
    );
  }
  paintHills(sketch, ground, light > 0.1 ? "day" : "night");
  sketch.fill(mix(SCENERY.grassDark, getColor("BLACK"), 0.5 * (1 - light)));
  sketch.rect(0, ground, width, height - ground);
  const wall = {
    height: height * 0.2,
    width: width * 0.3,
    x: width * 0.12,
    y: ground - height * 0.2,
  };
  const powered = charge > 1e-6 || solarPower(hour) >= demand(hour);
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      sketch.fill(
        mix(
          mix(getColor("STONE", 600), getColor("WHITE"), 0.6),
          getColor("BLACK"),
          0.6 * (1 - light)
        )
      );
      sketch.rect(wall.x, wall.y, wall.width, wall.height);
    }
  );
  sketch.fill(mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.35));
  sketch.quad(
    wall.x - 8,
    wall.y,
    wall.x + wall.width + 8,
    wall.y,
    wall.x + wall.width - 10,
    wall.y - height * 0.08,
    wall.x + 10,
    wall.y - height * 0.08
  );
  const evening = hour >= 18 && hour < 22;
  for (let pane = 0; pane < 3; pane += 1) {
    const glow = powered && (evening || light < 0.2);
    sketch.fill(
      glow
        ? mix(PLOT_COLORS.amber, getColor("WHITE"), 0.55)
        : mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.4)
    );
    sketch.rect(
      wall.x + wall.width * (0.12 + pane * 0.3),
      wall.y + wall.height * 0.3,
      wall.width * 0.16,
      wall.height * 0.3
    );
    if (glow) {
      spotlight(
        sketch,
        {
          x: wall.x + wall.width * (0.2 + pane * 0.3),
          y: wall.y + wall.height * 0.45,
        },
        wall.width * 0.25,
        { color: PLOT_COLORS.amber, strength: 0.35 }
      );
    }
  }
  const cabinet = {
    height: height * 0.16,
    width: width * 0.07,
    x: wall.x + wall.width + width * 0.04,
    y: ground - height * 0.16,
  };
  sketch.fill(getColor("SLATE", 600));
  sketch.rect(cabinet.x, cabinet.y, cabinet.width, cabinet.height, 4);
  const filled = (charge / size) * (cabinet.height - 8);
  sketch.fill(CHARGE);
  sketch.rect(
    cabinet.x + 4,
    cabinet.y + cabinet.height - 4 - filled,
    cabinet.width - 8,
    filled,
    2
  );
}

/** The day's chart: sunlight and demand as lines, and the battery's charge as a filled band. */
function paintChart(
  sketch: p5,
  charges: readonly number[],
  size: number,
  hour: number
) {
  const { height, width } = sketch;
  const chart = {
    bottom: height * 0.94,
    left: width * 0.55,
    right: width * 0.96,
    top: height * 0.08,
  };
  sketch.fill(fade(getColor("ZINC", 950), 0.5));
  sketch.rect(
    chart.left - 10,
    chart.top - 10,
    chart.right - chart.left + 20,
    chart.bottom - chart.top + 20,
    8
  );
  const across = (at: number) =>
    chart.left + (at / 24) * (chart.right - chart.left);
  const high = chart.bottom - chart.top;
  sketch.fill(fade(CHARGE, 0.55));
  sketch.beginShape();
  sketch.vertex(across(0), chart.bottom);
  for (let at = 0; at <= hour; at += 0.25) {
    sketch.vertex(
      across(at),
      chart.bottom - (chargeAt(charges, at) / 15) * high
    );
  }
  sketch.vertex(across(hour), chart.bottom);
  sketch.endShape(sketch.CLOSE);
  sketch.noFill();
  for (const [color, read] of [
    [SOLAR, solarPower],
    [DEMAND, demand],
  ] as const) {
    sketch.stroke(color);
    sketch.strokeWeight(2);
    sketch.beginShape();
    for (let at = 0; at <= 24; at += 0.25) {
      sketch.vertex(across(at), chart.bottom - (read(at) / SOLAR_PEAK) * high);
    }
    sketch.endShape();
  }
  sketch.stroke(fade(getColor("WHITE"), 0.6));
  sketch.strokeWeight(1);
  sketch.line(
    chart.left,
    chart.bottom - (size / 15) * high,
    chart.right,
    chart.bottom - (size / 15) * high
  );
  sketch.stroke(fade(getColor("WHITE"), 0.85));
  sketch.line(across(hour), chart.top, across(hour), chart.bottom);
  sketch.noStroke();
}

/** Draws a day at the health post, sped up, beside the chart of its energy. */
function storageProgram(sketch: p5, read: () => StorageFrame) {
  let time = 20;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { charges, size } = read();
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration: 24,
        hold: 0,
        rate: 24 / DAY_SECONDS,
      });
    }
    const hour = Math.min(time, 24 - STEP);
    paintPost(
      sketch,
      hour,
      chargeAt(charges, hour),
      size,
      sketch.height * 0.78
    );
    paintChart(sketch, charges, size, hour);
    vignette(sketch, 0.3);
  };
}

interface SolarBatteryStorageLabProps {
  description: ReactNode;
  labels: {
    chooseSize: string;
    demand: ReactNode;
    size: ReactNode;
    solar: ReactNode;
    unmet: ReactNode;
    viewLabel: string;
  };
  /** The battery's size at first, in kilowatt-hours. */
  size?: (typeof BATTERY_SIZES)[number];
  title: ReactNode;
}

/**
 * A village health post on a 3 kWp solar roof with a battery, through one day.
 * The roof makes more than the post uses in the day, but the vaccine fridge and
 * the evening lights run after sunset, so the night depends on the battery: a
 * 5 kWh battery runs empty before morning, a 10 kWh one gets through.
 */
export function SolarBatteryStorageLab({
  description,
  labels,
  size: initialSize = 5,
  title,
}: SolarBatteryStorageLabProps) {
  const [size, setSize] = useState<number>(initialSize);
  const measure = useQuantity();
  const day = useMemo(() => storageDay(size), [size]);
  const isSize = Schema.is(SizeSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSize}
          gridColumns="3"
          onValueChange={(value) => {
            if (isSize(value)) {
              setSize(Number(value));
            }
          }}
          type="single"
          value={String(size)}
          variant="outline"
        >
          {Arr.map(BATTERY_SIZES, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={measure(option, "\\text{ kWh}", 0)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={storageProgram}
          state={{ charges: day.charges, size }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={SOLAR}
            label={labels.solar}
            value={
              <InlineMath math={measure(solarEnergy(), "\\text{ kWh}", 1)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={DEMAND}
            label={labels.demand}
            value={
              <InlineMath math={measure(demandEnergy(), "\\text{ kWh}", 1)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={CHARGE}
            label={labels.size}
            value={<InlineMath math={measure(size, "\\text{ kWh}", 0)} />}
          />
          <VisualFactTabular
            label={labels.unmet}
            value={<InlineMath math={measure(day.unmet, "\\text{ kWh}", 1)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
