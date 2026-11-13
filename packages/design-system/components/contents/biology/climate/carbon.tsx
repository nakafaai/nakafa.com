import {
  BUDGET,
  cutOf,
  fossilIn,
  pathwayOf,
  RECORD_SPAN,
  type Region,
  RegionSchema,
  recordLevel,
  recordRate,
  type Year,
} from "@repo/design-system/components/contents/biology/climate/budget";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** The year pathways run to. */
const END_YEAR = 2100;

/** The tank is empty at 250 ppm and full at 600 ppm. */
const TANK = { empty: 250, full: 600 } as const;

/** GtC to GtCO2. */
const CO2_PER_C = 3.664;

/** What the sketch reads from the card on every frame. */
type Tub = Readonly<{
  baseline: readonly Year[];
  inflow: Readonly<{ emitted: string; taken: string }>;
  pathway: readonly Year[];
  record: boolean;
  year: number;
}>;

/**
 * The air as a bathtub: emissions pour in from the tap, the ocean and the land
 * drain part of it away, and the water level is the CO2 in the air. In
 * `record` mode a slider walks through Mauna Loa's measurements since 1960;
 * in `cooperate` mode the reader picks which regions cut their fossil CO2 to
 * zero by 2050; in `mitigate` mode two sliders cut fossil CO2 and grow
 * forests. A graph beside the tub draws the level year by year, and the
 * footer reads the outcome.
 */
export function CarbonBudgetLab({
  description,
  labels,
  mode,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly above?: ReactNode;
    readonly chooseRegions?: string;
    readonly cut?: string;
    readonly emissions?: ReactNode;
    readonly forest?: string;
    readonly inflow: Readonly<{ emitted: string; taken: string }>;
    readonly level: ReactNode;
    readonly peak?: ReactNode;
    readonly rate?: ReactNode;
    readonly regions?: Readonly<Record<Region, ReactNode>>;
    readonly rise?: ReactNode;
    readonly viewLabel: string;
    readonly warming?: ReactNode;
    readonly year?: string;
  };
  readonly mode: "cooperate" | "mitigate" | "record";
  readonly title: ReactNode;
}) {
  const [year, setYear] = useState<number>(RECORD_SPAN.last);
  const [joined, setJoined] = useState<readonly Region[]>([]);
  const [cut, setCut] = useState(0);
  const [forest, setForest] = useState(0);
  const quantity = useQuantity();
  const plan = useMemo(
    () =>
      mode === "cooperate"
        ? { cut: cutOf(joined), forest: 0 }
        : { cut, forest: forest / CO2_PER_C },
    [cut, forest, joined, mode]
  );
  const pathway = useMemo(() => pathwayOf(plan, END_YEAR), [plan]);
  const baseline = useMemo(() => pathwayOf({ cut: 0, forest: 0 }, END_YEAR), []);
  const tub = useMemo(
    () => ({ baseline, inflow: labels.inflow, pathway, record: mode === "record", year }),
    [baseline, labels.inflow, mode, pathway, year]
  );
  const last = Option.getOrElse(Arr.last(pathway), () => baseline[0]);
  const peak = Arr.reduce(pathway, 0, (high, each) => Math.max(high, each.level));
  const in2050 = (fossilIn(2050, plan) + BUDGET.land - plan.forest) * CO2_PER_C;
  const ppm = "\\text{ ppm}";

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {mode === "record" && (
          <Labeled label={labels.year} shown={String(Math.round(year))}>
            <Slider
              aria-label={labels.year}
              max={RECORD_SPAN.last}
              min={RECORD_SPAN.first}
              onValueChange={setYear}
              step={1}
              value={year}
            />
          </Labeled>
        )}
        {mode === "cooperate" && labels.regions && (
          <ToggleGroup
            aria-label={labels.chooseRegions}
            onValueChange={(value: readonly string[]) =>
              setJoined(Arr.filter(value, Schema.is(RegionSchema)))
            }
            type="multiple"
            value={joined}
            variant="outline"
          >
            {Arr.map(RegionSchema.literals, (region) => (
              <ToggleGroupItem key={region} value={region}>
                {labels.regions?.[region]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {mode === "mitigate" && (
          <>
            <Labeled label={labels.cut} shown={`${Math.round(cut * 100)}%`}>
              <Slider aria-label={labels.cut} max={1} min={0} onValueChange={setCut} step={0.05} value={cut} />
            </Labeled>
            <Labeled label={labels.forest} shown={String(forest)}>
              <Slider aria-label={labels.forest} max={7} min={0} onValueChange={setForest} step={0.5} value={forest} />
            </Labeled>
          </>
        )}
      </VisualCardToolbar>

      <VisualCardBody className="bg-card">
        <P5Sketch label={labels.viewLabel} program={tubProgram} state={tub} />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        {mode === "record" ? (
          <VisualCardFacts>
            <VisualFactTabular label={labels.level} value={<InlineMath math={quantity(recordLevel(year), ppm, 1)} />} />
            <VisualFactTabular label={labels.rise} value={<InlineMath math={quantity(recordLevel(year) - recordLevel(RECORD_SPAN.first), ppm, 1)} />} />
            <VisualFactTabular label={labels.rate} value={<InlineMath math={quantity(recordRate(year), ppm, 2)} />} />
            <VisualFactTabular label={labels.above} value={<InlineMath math={quantity((recordLevel(year) / BUDGET.preindustrial - 1) * 100, "\\%", 0)} />} />
          </VisualCardFacts>
        ) : (
          <VisualCardFacts>
            <VisualFactTabular label={labels.level} value={<InlineMath math={quantity(last?.level ?? BUDGET.start, ppm, 0)} />} />
            <VisualFactTabular label={labels.warming} value={<InlineMath math={quantity(last?.warming ?? BUDGET.startWarming, "\\,^\\circ\\text{C}", 1)} />} />
            <VisualFactTabular label={labels.emissions} value={<InlineMath math={quantity(in2050, "\\text{ Gt}", 1)} />} />
            <VisualFactTabular label={labels.peak} value={<InlineMath math={quantity(peak, ppm, 0)} />} />
          </VisualCardFacts>
        )}
      </VisualCardFooter>
    </VisualCard>
  );
}

/** A slider with its name and its value above it. */
function Labeled({
  children,
  label,
  shown,
}: {
  readonly children: ReactNode;
  readonly label?: string | undefined;
  readonly shown: string;
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{shown}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * The sketch: a glass tub on the left whose tap and drain run as wide as the
 * year's emissions and uptake, and on the right a graph of the CO2 level.
 * A pathway draws itself from 2024 to 2100 while it plays, beside the path
 * of no action.
 */
function tubProgram(sketch: p5, read: () => Tub) {
  let drawnTo = END_YEAR;
  let shown: Tub | undefined;

  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };

  sketch.draw = () => {
    const tub = read();
    if (tub !== shown) {
      drawnTo = sketch.isLooping() && shown !== undefined && !tub.record ? BUDGET.startYear : END_YEAR;
      shown = tub;
    }
    drawnTo = Math.min(END_YEAR, drawnTo + Math.min(0.1, sketch.deltaTime / 1000) * 10);
    sketch.background(getColor("SLATE", 50));
    const current = tub.record
      ? { emitted: 0, level: recordLevel(tub.year), taken: 0 }
      : yearOf(tub.pathway, drawnTo);
    drawTub(sketch, current.level, current.emitted, current.taken, tub);
    drawChart(sketch, tub, drawnTo);
  };
}

/** The level, emissions and uptake of a pathway in `year`. */
function yearOf(pathway: readonly Year[], year: number) {
  const index = Math.max(0, Math.min(pathway.length - 1, Math.round(year - BUDGET.startYear)));
  const each = pathway[index];
  const level = each?.level ?? BUDGET.start;
  const taken = (BUDGET.sinks * (level - BUDGET.preindustrial)) / (BUDGET.start - BUDGET.preindustrial);
  return { emitted: (each?.net ?? 0) + taken, level, taken };
}

/** The tub, its water at `level`, the tap and the drain. */
function drawTub(sketch: p5, level: number, emitted: number, taken: number, tub: Tub) {
  const left = sketch.width * 0.06;
  const width = sketch.width * 0.3;
  const top = sketch.height * 0.2;
  const bottom = sketch.height * 0.88;
  const share = (level - TANK.empty) / (TANK.full - TANK.empty);
  const surface = bottom - (bottom - top) * Math.min(1, Math.max(0, share));
  sketch.noStroke();
  sketch.fill(MATERIAL.seawater);
  sketch.rect(left, surface, width, bottom - surface);
  sketch.noFill();
  sketch.stroke(getColor("SLATE", 600));
  sketch.strokeWeight(3);
  sketch.line(left, top, left, bottom);
  sketch.line(left, bottom, left + width, bottom);
  sketch.line(left + width, top, left + width, bottom);
  const preindustrial = bottom - (bottom - top) * ((BUDGET.preindustrial - TANK.empty) / (TANK.full - TANK.empty));
  sketch.strokeWeight(1);
  Arr.forEach(Arr.range(0, Math.floor(width / 8)), (dash) => {
    sketch.line(left + dash * 8, preindustrial, left + dash * 8 + 4, preindustrial);
  });
  if (!tub.record) {
    sketch.noStroke();
    sketch.fill(MATERIAL.seawater);
    sketch.rect(left + width * 0.2, top - 26, Math.max(2, emitted * 1.6), surface - top + 26);
    sketch.rect(left + width, bottom - 14, sketch.width * 0.06, Math.max(2, taken * 1.6));
    sketch.fill(getColor("GRAY", 800));
    sketch.textSize(11);
    sketch.textAlign(sketch.LEFT, sketch.BOTTOM);
    sketch.text(tub.inflow.emitted, left + width * 0.2, top - 30);
    sketch.textAlign(sketch.LEFT, sketch.TOP);
    sketch.text(tub.inflow.taken, left + width, bottom + 4);
  }
}

/** The CO2 level over the years, with axis ticks, beside the tub. */
function drawChart(sketch: p5, tub: Tub, drawnTo: number) {
  const left = sketch.width * 0.46;
  const right = sketch.width - 16;
  const top = sketch.height * 0.12;
  const bottom = sketch.height * 0.86;
  const first = tub.record ? RECORD_SPAN.first : BUDGET.startYear;
  const last = tub.record ? RECORD_SPAN.last : END_YEAR;
  const low = tub.record ? 300 : 380;
  const high = tub.record ? 440 : 560;
  const x = (year: number) => left + ((right - left) * (year - first)) / (last - first);
  const y = (ppm: number) => bottom - ((bottom - top) * (ppm - low)) / (high - low);
  sketch.stroke(getColor("SLATE", 300));
  sketch.strokeWeight(1);
  sketch.line(left, bottom, right, bottom);
  sketch.line(left, top, left, bottom);
  sketch.noStroke();
  sketch.fill(getColor("GRAY", 700));
  sketch.textSize(10);
  sketch.textAlign(sketch.CENTER, sketch.TOP);
  sketch.text(String(first), x(first), bottom + 4);
  sketch.text(String(last), x(last), bottom + 4);
  sketch.textAlign(sketch.RIGHT, sketch.CENTER);
  sketch.text(String(low), left - 4, y(low));
  sketch.text(String(high), left - 4, y(high));
  sketch.noFill();
  sketch.strokeWeight(2);
  if (tub.record) {
    sketch.stroke(PLOT_COLORS.orange);
    sketch.beginShape();
    Arr.forEach(Arr.range(first, Math.round(tub.year)), (year) => {
      sketch.vertex(x(year), y(recordLevel(year)));
    });
    sketch.endShape();
    return;
  }
  sketch.stroke(PLOT_COLORS.slate);
  sketch.strokeWeight(1);
  sketch.beginShape();
  Arr.forEach(tub.baseline, (each) => sketch.vertex(x(each.year), y(each.level)));
  sketch.endShape();
  sketch.strokeWeight(2.5);
  sketch.stroke(PLOT_COLORS.orange);
  sketch.beginShape();
  Arr.forEach(
    Arr.filter(tub.pathway, (each) => each.year <= drawnTo),
    (each) => sketch.vertex(x(each.year), y(each.level))
  );
  sketch.endShape();
}
