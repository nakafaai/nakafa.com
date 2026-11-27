import { BiologyTrace } from "@repo/design-system/components/contents/biology/chart";
import type {
  Region,
  Year,
} from "@repo/design-system/components/contents/biology/climate/budget";
import {
  BUDGET,
  cutOf,
  fossilIn,
  pathwayOf,
  RECORD_SPAN,
  RegionSchema,
  recordLevel,
  recordRate,
  YearSchema,
} from "@repo/design-system/components/contents/biology/climate/budget";
import { drawTub } from "@repo/design-system/components/contents/biology/climate/tub";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

/** The year pathways run to. */
const END_YEAR = 2100;

/** The CO2 levels the chart's vertical axis spans, in ppm, for the record and for pathways. */
const SPAN = {
  pathway: { high: 600, low: 300 },
  record: { high: 440, low: 300 },
} as const;

/** GtC to GtCO2. */
const CO2_PER_C = 3.664;

/** What the sketch reads from the card on every frame. */
const TubSchema = Schema.Struct({
  pathway: Schema.Array(YearSchema),
  record: Schema.Boolean,
  year: Schema.Finite,
});
type Tub = typeof TubSchema.Type;

/**
 * The air as a bathtub: emissions pour in from the tap, the ocean and the land
 * drain part of it away, and the water level is the CO2 in the air. In
 * `record` mode a slider walks through Mauna Loa's measurements since 1960;
 * in `cooperate` mode the reader picks which regions cut their fossil CO2 to
 * zero by 2050; in `mitigate` mode two sliders cut fossil CO2 and grow
 * forests. The footer charts the level year by year, beside the path of no
 * action where there is one, and reads the outcome.
 */
export function CarbonBudgetLab({
  description,
  labels,
  mode,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly above?: ReactNode;
    readonly chooseRegions?: string;
    readonly cut?: string;
    readonly emissions?: ReactNode;
    readonly forest?: string;
    readonly level: ReactNode;
    readonly peak?: ReactNode;
    readonly perYear?: string;
    readonly rate?: ReactNode;
    readonly regions?: Readonly<Record<Region, ReactNode>>;
    readonly rise?: ReactNode;
    readonly viewLabel: string;
    readonly warming?: ReactNode;
    readonly year?: string;
  };
  readonly mode: "cooperate" | "mitigate" | "record";
  readonly title: NonNullable<ReactNode>;
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
  const baseline = useMemo(
    () => pathwayOf({ cut: 0, forest: 0 }, END_YEAR),
    []
  );
  const tub = useMemo(
    () => ({ pathway, record: mode === "record", year }),
    [mode, pathway, year]
  );
  const rows = useMemo(
    () =>
      mode === "record"
        ? Arr.map(Arr.range(RECORD_SPAN.first, RECORD_SPAN.last), (each) => ({
            level: recordLevel(each),
            x: each,
          }))
        : Arr.map(pathway, (each, index) => ({
            baseline: baseline[index]?.level ?? each.level,
            level: each.level,
            x: each.year,
          })),
    [baseline, mode, pathway]
  );
  const span = SPAN[mode === "record" ? "record" : "pathway"];
  const last = Option.getOrElse(Arr.last(pathway), () => baseline[0]);
  const peak = Arr.reduce(pathway, 0, (high, each) =>
    Math.max(high, each.level)
  );
  const in2050 = (fossilIn(2050, plan) + BUDGET.land - plan.forest) * CO2_PER_C;
  const ppm = "\\text{ ppm}";

  return (
    <VisualCard
      onReset={() => {
        setYear(RECORD_SPAN.last);
        setJoined([]);
        setCut(0);
        setForest(0);
      }}
    >
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
              <Slider
                aria-label={labels.cut}
                max={1}
                min={0}
                onValueChange={setCut}
                step={0.05}
                value={cut}
              />
            </Labeled>
            <Labeled label={labels.forest} shown={String(forest)}>
              <Slider
                aria-label={labels.forest}
                max={7}
                min={0}
                onValueChange={setForest}
                step={0.5}
                value={forest}
              />
            </Labeled>
          </>
        )}
      </VisualCardToolbar>

      <VisualCardBody className="bg-card">
        <P5Sketch label={labels.viewLabel} program={tubProgram} state={tub} />
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <BiologyTrace
          cursor={
            mode === "record" ? { x: year, y: recordLevel(year) } : undefined
          }
          floor={span.low}
          rows={rows}
          series={[
            ...(mode === "record"
              ? []
              : [{ color: PLOT_COLORS.slate, dashed: true, key: "baseline" }]),
            { color: PLOT_COLORS.orange, key: "level", label: labels.level },
          ]}
          top={span.high}
        />
        {mode === "record" ? (
          <VisualCardFacts>
            <VisualFactIndicator
              indicatorColor={PLOT_COLORS.orange}
              label={labels.level}
              value={<InlineMath math={quantity(recordLevel(year), ppm, 1)} />}
            />
            <VisualFactTabular
              label={labels.rise}
              value={
                <InlineMath
                  math={quantity(
                    recordLevel(year) - recordLevel(RECORD_SPAN.first),
                    ppm,
                    1
                  )}
                />
              }
            />
            <VisualFactTabular
              label={labels.rate}
              value={
                <InlineMath
                  math={quantity(
                    recordRate(year),
                    `\\text{ ppm/${labels.perYear ?? ""}}`,
                    2
                  )}
                />
              }
            />
            <VisualFactTabular
              label={labels.above}
              value={
                <InlineMath
                  math={quantity(
                    (recordLevel(year) / BUDGET.preindustrial - 1) * 100,
                    "\\%",
                    0
                  )}
                />
              }
            />
          </VisualCardFacts>
        ) : (
          <VisualCardFacts>
            <VisualFactIndicator
              indicatorColor={PLOT_COLORS.orange}
              label={labels.level}
              value={
                <InlineMath
                  math={quantity(last?.level ?? BUDGET.start, ppm, 0)}
                />
              }
            />
            <VisualFactTabular
              label={labels.warming}
              value={
                <InlineMath
                  math={quantity(
                    last?.warming ?? BUDGET.startWarming,
                    "\\,^\\circ\\text{C}",
                    1
                  )}
                />
              }
            />
            <VisualFactTabular
              label={labels.emissions}
              value={<InlineMath math={quantity(in2050, "\\text{ Gt}", 1)} />}
            />
            <VisualFactTabular
              label={labels.peak}
              value={<InlineMath math={quantity(peak, ppm, 0)} />}
            />
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
 * The sketch: an enamelled bathtub whose filler and waste run as wide as the
 * year's emissions and uptake, and nothing else. While it plays, a pathway
 * fills or drains the tub from 2024 to 2100.
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
      drawnTo =
        sketch.isLooping() && shown !== undefined && !tub.record
          ? BUDGET.startYear
          : END_YEAR;
      shown = tub;
    }
    drawnTo = Math.min(
      END_YEAR,
      drawnTo + Math.min(0.1, sketch.deltaTime / 1000) * 10
    );
    sketch.clear();
    const current = tub.record
      ? { emitted: 0, level: recordLevel(tub.year), taken: 0 }
      : yearOf(tub.pathway, drawnTo);
    drawTub(sketch, current, tub.record);
  };
}

/** The level, emissions and uptake of a pathway in `year`. */
function yearOf(pathway: readonly Year[], year: number) {
  const index = Math.max(
    0,
    Math.min(pathway.length - 1, Math.round(year - BUDGET.startYear))
  );
  const each = pathway[index];
  const level = each?.level ?? BUDGET.start;
  const taken =
    (BUDGET.sinks * (level - BUDGET.preindustrial)) /
    (BUDGET.start - BUDGET.preindustrial);
  return { emitted: (each?.net ?? 0) + taken, level, taken };
}
