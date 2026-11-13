import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  energyBalance,
  INVESTED_ENERGY,
  paybackYears,
  returnRatio,
  YIELD,
  yearlyEnergy,
} from "@repo/design-system/components/contents/physics/renewable-energy/payback/years";
import {
  paintClouds,
  paintHills,
  paintSky,
  paintSun,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The years the chart spans, from installation. */
const CHART_YEARS = 5;

/** How many wall seconds the chart's years play in. */
const PLAY_SECONDS = 7;

/** How long the finished chart rests before it starts again, in seconds. */
const HOLD_SECONDS = 1.5;

/** The colors of the energy owed and the energy gained. */
const DEBT = PLOT_COLORS.pink;
const GAIN = PLOT_COLORS.teal;

/** The highest balance the chart has room for, in kilowatt-hours. */
const CHART_TOP = energyBalance(YIELD.max, CHART_YEARS);

/** What the sketch reads on every frame: the yearly yield per kWp. */
const PaybackFrameSchema = Schema.Struct({ yieldPerPeak: Schema.Finite });
type PaybackFrame = typeof PaybackFrameSchema.Type;

/** The house and its six panels in the sun, the sun as strong as the yield. */
function paintHouse(
  sketch: p5,
  ground: number,
  strength: number,
  time: number
) {
  const { height, width } = sketch;
  paintSky(sketch, ground);
  paintSun(
    sketch,
    { x: width * 0.84, y: height * 0.08 },
    Math.max(height * 0.03, 8),
    strength
  );
  paintClouds(sketch, ground, time, 1 - strength * 0.6);
  paintHills(sketch, ground);
  gradientRect(sketch, { height: height - ground, width, x: 0, y: ground }, [
    [0, MATERIAL.grass],
    [1, MATERIAL.foliageDark],
  ]);
  const wall = {
    height: height * 0.14,
    width: width * 0.26,
    x: width * 0.08,
    y: ground - height * 0.14,
  };
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.5), drop: 6 },
    () => {
      gradientRect(sketch, wall, [
        [0, MATERIAL.wallPlaster],
        [1, mix(MATERIAL.wallPlaster, getColor("BLACK"), 0.15)],
      ]);
    }
  );
  const roof = MATERIAL.roofTerracotta;
  sketch.fill(roof);
  sketch.triangle(
    wall.x - width * 0.02,
    wall.y,
    wall.x + wall.width + width * 0.02,
    wall.y,
    wall.x + wall.width / 2,
    wall.y - height * 0.12
  );
  sketch.fill(MATERIAL.solarCell);
  for (let panel = 0; panel < 3; panel += 1) {
    const left = wall.x + wall.width * (0.52 + panel * 0.12);
    sketch.quad(
      left,
      wall.y - height * 0.01,
      left + wall.width * 0.11,
      wall.y - height * 0.01,
      left + wall.width * 0.06,
      wall.y - height * 0.09,
      left - wall.width * 0.04,
      wall.y - height * 0.09
    );
  }
}

/**
 * The energy account over the first five years: it starts owing the energy
 * spent on making the system and climbs at the yearly yield, pink below
 * zero and teal above, with a mark where it crosses into profit.
 */
function paintAccount(sketch: p5, yieldPerPeak: number, years: number) {
  const { height, width } = sketch;
  const chart = {
    bottom: height * 0.95,
    left: width * 0.42,
    right: width * 0.95,
    top: height * 0.08,
  };
  sketch.fill(fade(getColor("ZINC", 950), 0.45));
  sketch.rect(
    chart.left - 12,
    chart.top - 10,
    chart.right - chart.left + 24,
    chart.bottom - chart.top + 20,
    8
  );
  const scale = (chart.bottom - chart.top) / (CHART_TOP + INVESTED_ENERGY);
  const zero = chart.bottom - INVESTED_ENERGY * scale;
  const columns = Math.round((chart.right - chart.left) / 3);
  for (let column = 0; column <= columns; column += 1) {
    const year = (column / columns) * CHART_YEARS;
    if (year > years) {
      break;
    }
    const balance = energyBalance(yieldPerPeak, year);
    const x = chart.left + column * 3;
    sketch.fill(balance < 0 ? DEBT : GAIN);
    sketch.rect(
      x,
      Math.min(zero, zero - balance * scale),
      3,
      Math.abs(balance) * scale
    );
  }
  sketch.stroke(fade(getColor("WHITE"), 0.7));
  sketch.strokeWeight(1);
  sketch.line(chart.left, zero, chart.right, zero);
  for (let year = 1; year <= CHART_YEARS; year += 1) {
    const x = chart.left + (year / CHART_YEARS) * (chart.right - chart.left);
    sketch.line(x, zero - 4, x, zero + 4);
  }
  sketch.noStroke();
  const payback = paybackYears(yieldPerPeak);
  if (years >= payback) {
    const x = chart.left + (payback / CHART_YEARS) * (chart.right - chart.left);
    dashed(
      sketch,
      { x, y: chart.top },
      { x, y: chart.bottom },
      { color: fade(PLOT_COLORS.amber, 0.9), dash: 5, weight: 2 }
    );
    sketch.fill(PLOT_COLORS.amber);
    sketch.circle(x, zero, 10);
  }
}

/** Draws the house and its energy account filling year by year. */
function paybackProgram(sketch: p5, read: () => PaybackFrame) {
  let time = 0;
  let clouds = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { yieldPerPeak } = read();
    if (sketch.isLooping()) {
      const elapsed = sketch.deltaTime / 1000;
      time = advanceRun(time, elapsed, {
        duration: CHART_YEARS,
        hold: HOLD_SECONDS,
        rate: CHART_YEARS / PLAY_SECONDS,
      });
      clouds += Math.min(elapsed, 0.1);
    } else {
      time = CHART_YEARS;
    }
    const strength =
      0.35 + (0.65 * (yieldPerPeak - YIELD.min)) / (YIELD.max - YIELD.min);
    paintHouse(sketch, sketch.height * 0.7, strength, clouds);
    paintAccount(sketch, yieldPerPeak, shownTime(time, CHART_YEARS));
    vignette(sketch, 0.3);
  };
}

interface SolarRoofPaybackLabProps {
  description: ReactNode;
  labels: {
    invested: ReactNode;
    lifetime: ReactNode;
    payback: ReactNode;
    viewLabel: string;
    yearly: ReactNode;
    yieldControl: string;
  };
  title: ReactNode;
  /** The yearly yield per kWp at first, in kilowatt-hours. */
  yieldPerPeak?: number;
}

/**
 * A 3 kWp solar roof starts in energy debt: making it took 3900 kWh. Each
 * year of sunshine pays some back, and the chart crosses zero at the
 * payback time. A sunnier site pays back sooner and returns its energy
 * more times over its 25 years.
 */
export function SolarRoofPaybackLab({
  description,
  labels,
  title,
  yieldPerPeak: initialYield = 1300,
}: SolarRoofPaybackLabProps) {
  const [yieldPerPeak, setYield] = useState(initialYield);
  const measure = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.yieldControl}
          max={YIELD.max}
          min={YIELD.min}
          name={labels.yieldControl}
          onValueChange={setYield}
          readout={
            <InlineMath math={measure(yieldPerPeak, "\\text{ kWh/kWp}", 0)} />
          }
          step={YIELD.step}
          value={yieldPerPeak}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={paybackProgram}
          state={{ yieldPerPeak }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={DEBT}
            label={labels.invested}
            value={
              <InlineMath math={measure(INVESTED_ENERGY, "\\text{ kWh}", 0)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={GAIN}
            label={labels.yearly}
            value={
              <InlineMath
                math={measure(yearlyEnergy(yieldPerPeak), "\\text{ kWh}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.payback}
            value={
              <InlineMath math={measure(paybackYears(yieldPerPeak), "", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.lifetime}
            value={
              <InlineMath
                math={`${measure(returnRatio(yieldPerPeak), "", 1)}\\times`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
