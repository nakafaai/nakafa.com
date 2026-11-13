import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  dashed,
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  CAPACITY,
  dailyEnergy,
  hoursOver,
  peakLoad,
  type Schedule,
  ScheduleSchema,
  villageLoad,
} from "@repo/design-system/components/contents/physics/renewable-energy/grid/load";
import {
  paintHills,
  paintSky,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
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

/** How many wall seconds a whole day plays in. */
const DAY_SECONDS = 12;

/** The colors of the demand, the grid's capacity, and the hour the grid falls short. */
const DEMAND = PLOT_COLORS.orange;
const LIMIT = getColor("SLATE", 200);
const SHORT = PLOT_COLORS.pink;

/** The highest demand the chart has room for, in kilowatts. */
const CHART_TOP = 70;

/** The houses the village shows, as shares across the canvas. */
const HOUSES = [
  0.06, 0.15, 0.24, 0.35, 0.45, 0.56, 0.66, 0.75, 0.84, 0.92,
] as const;

/** What the sketch reads on every frame: when the village cooks. */
const GridFrameSchema = Schema.Struct({ schedule: ScheduleSchema });
type GridFrame = typeof GridFrameSchema.Type;

/** The daylight at `hour`, from 0 at night to 1 at noon. */
function daylight(hour: number) {
  return Math.max(Math.sin(((hour - 6) / 12) * Math.PI), 0);
}

/** The village at `hour`: its sky, and windows lit as long as the grid keeps up with demand. */
function paintVillage(sketch: p5, hour: number, lit: boolean, ground: number) {
  const { height, width } = sketch;
  const light = daylight(hour);
  paintSky(sketch, ground, light > 0.15 ? "day" : "night");
  gradientRect(sketch, { height: ground, width, x: 0, y: 0 }, [
    [0, fade(getColor("ZINC", 950), 0.85 * (1 - light))],
    [1, fade(getColor("ZINC", 950), 0.6 * (1 - light))],
  ]);
  paintHills(sketch, ground, light > 0.15 ? "day" : "night");
  sketch.fill(mix(MATERIAL.foliageDark, getColor("BLACK"), 0.6 * (1 - light)));
  sketch.rect(0, ground, width, height - ground);
  const size = Math.min(width * 0.06, height * 0.12);
  Arr.forEach(HOUSES, (at, index) => {
    const x = width * at;
    const wall = mix(
      MATERIAL.wallPlaster,
      getColor("BLACK"),
      0.65 * (1 - light)
    );
    sketch.fill(wall);
    sketch.rect(x - size / 2, ground - size * 0.75, size, size * 0.75);
    sketch.fill(
      mix(MATERIAL.roofTerracotta, getColor("BLACK"), 0.5 * (1 - light))
    );
    sketch.triangle(
      x - size * 0.62,
      ground - size * 0.75,
      x + size * 0.62,
      ground - size * 0.75,
      x,
      ground - size * 1.2
    );
    const glowing = lit && light < 0.6 && (index + Math.floor(hour)) % 7 !== 0;
    sketch.fill(
      glowing
        ? MATERIAL.windowGlow
        : mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.3)
    );
    sketch.rect(x - size * 0.25, ground - size * 0.5, size * 0.2, size * 0.2);
    sketch.rect(x + size * 0.05, ground - size * 0.5, size * 0.2, size * 0.2);
    if (glowing) {
      spotlight(sketch, { x, y: ground - size * 0.4 }, size * 0.9, {
        color: MATERIAL.windowGlow,
        strength: 0.3 * (1 - light),
      });
    }
  });
}

/** The day's demand hour by hour, the grid's limit, and the hour that passes it. */
function paintCurve(sketch: p5, schedule: Schedule, hour: number) {
  const { height, width } = sketch;
  const chart = {
    bottom: height * 0.95,
    left: width * 0.05,
    right: width * 0.95,
    top: height * 0.6,
  };
  gradientRect(
    sketch,
    { height: height - chart.top + 10, width, x: 0, y: chart.top - 10 },
    [
      [0, fade(getColor("ZINC", 950), 0.8)],
      [1, getColor("ZINC", 950)],
    ]
  );
  const scale = (chart.bottom - chart.top) / CHART_TOP;
  const slot = (chart.right - chart.left) / 24;
  Arr.forEach(villageLoad(schedule), (power, index) => {
    const tall = power * scale;
    const past = index <= hour;
    sketch.fill(fade(power > CAPACITY ? SHORT : DEMAND, past ? 0.95 : 0.25));
    sketch.rect(
      chart.left + index * slot + 1,
      chart.bottom - tall,
      slot - 2,
      tall
    );
  });
  dashed(
    sketch,
    { x: chart.left, y: chart.bottom - CAPACITY * scale },
    { x: chart.right, y: chart.bottom - CAPACITY * scale },
    { color: LIMIT, dash: 6, weight: 2 }
  );
  const cursor = chart.left + (hour / 24) * (chart.right - chart.left);
  sketch.stroke(fade(getColor("WHITE"), 0.85));
  sketch.strokeWeight(1.5);
  sketch.line(cursor, chart.top, cursor, chart.bottom);
  sketch.line(chart.left, chart.bottom, chart.right, chart.bottom);
  sketch.noStroke();
}

/** Draws a day in the village, sped up, beside the demand curve it follows. */
function gridProgram(sketch: p5, read: () => GridFrame) {
  let time = 18.5;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { schedule } = read();
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration: 24,
        hold: 0,
        rate: 24 / DAY_SECONDS,
      });
    }
    const hour = Math.min(Math.floor(time), 23);
    const power = Arr.getUnsafe(villageLoad(schedule), hour);
    paintVillage(sketch, time, power <= CAPACITY + 1e-9, sketch.height * 0.5);
    paintCurve(sketch, schedule, hour);
    vignette(sketch, 0.3);
  };
}

interface GridLoadCurveLabProps {
  description: ReactNode;
  labels: {
    capacity: ReactNode;
    chooseSchedule: string;
    energy: ReactNode;
    hours: ReactNode;
    peak: ReactNode;
    schedules: Record<Schedule, ReactNode>;
    viewLabel: string;
  };
  /** When the village cooks at first. */
  schedule?: Schedule;
  title: ReactNode;
}

/**
 * A village of 100 homes through one day on a 50 kW mini-grid, above its
 * hourly demand curve. Cooking all at once pushes the evening peak to 65 kW
 * and the lights go out for that hour; spreading the same cooking keeps the
 * peak at 35 kW. Both days use the same 330 kWh.
 */
export function GridLoadCurveLab({
  description,
  labels,
  schedule: initialSchedule = "together",
  title,
}: GridLoadCurveLabProps) {
  const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
  const measure = useQuantity();
  const isSchedule = Schema.is(ScheduleSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSchedule}
          gridColumns="2"
          onValueChange={(value) => {
            if (isSchedule(value)) {
              setSchedule(value);
            }
          }}
          type="single"
          value={schedule}
          variant="outline"
        >
          {Arr.map(ScheduleSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.schedules[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={gridProgram}
          state={{ schedule }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath
                math={measure(dailyEnergy(schedule), "\\text{ kWh}", 0)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={DEMAND}
            label={labels.peak}
            value={
              <InlineMath
                math={measure(peakLoad(schedule), "\\text{ kW}", 0)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={LIMIT}
            label={labels.capacity}
            value={<InlineMath math={measure(CAPACITY, "\\text{ kW}", 0)} />}
          />
          <VisualFactIndicator
            indicatorColor={SHORT}
            label={labels.hours}
            value={
              <InlineMath
                math={measure(hoursOver(schedule), "\\text{ h}", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
