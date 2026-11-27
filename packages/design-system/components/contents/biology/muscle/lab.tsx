import { BiologyTrace } from "@repo/design-system/components/contents/biology/chart";
import {
  demand,
  force,
  lactic,
  RUN,
  repaid,
  shortfall,
  stageAt,
  trace,
  uptake,
} from "@repo/design-system/components/contents/biology/muscle/debt";
import { LacticGauge } from "@repo/design-system/components/contents/biology/muscle/gauge";
import { PoseProvider } from "@repo/design-system/components/contents/biology/muscle/pose";
import { MuscleScene } from "@repo/design-system/components/contents/biology/muscle/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** The minute of the run the card opens at: three minutes into exercise, while the shortfall still grows. */
const OPENING = 5;

/** The steps the demand slider moves in, in litres a minute. */
const DEMAND_STEP = 0.1;

/**
 * A working skeletal muscle at tissue scale that runs short of oxygen. At
 * rest the fibres take up `rest` litres of oxygen a minute. From minute 2 to
 * minute 8 the exercise needs `demand` litres a minute more, but uptake only
 * climbs towards it, so the fibres cover the shortfall by lactic acid
 * fermentation: lactic acid builds in them and their contractions weaken.
 * After minute 8 the fibres rest while uptake stays high, repaying the
 * oxygen debt as blood carries the lactic acid to the liver. The footer
 * charts uptake against time, the shortfall shaded amber and the debt blue. The readouts of the whole demand
 * (`labels.need`) and of the force left (`labels.force`), and the liver's
 * callout (`labels.parts.liver`), show only when their labels are given.
 */
export function OxygenDebtLab({
  demand: range,
  description,
  labels,
  rest,
  title,
}: {
  readonly demand: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly debt: ReactNode;
    readonly demand: string;
    readonly force?: ReactNode;
    readonly lactic: ReactNode;
    readonly need?: ReactNode;
    readonly parts: {
      readonly capillary: string;
      readonly cell: string;
      readonly fibre: string;
      readonly liver?: string;
    };
    readonly shortfall: ReactNode;
    readonly time: string;
    readonly uptake: ReactNode;
    readonly view: string;
  };
  readonly rest: number;
  readonly title: NonNullable<ReactNode>;
}) {
  const [work, setWork] = useState(range.value);
  const [minute, setMinute] = useState(OPENING);
  const rows = useMemo(
    () =>
      Arr.map(trace(rest, work, 128), (point) => {
        const stage = stageAt(point.minute);
        const need = demand(point.minute, rest, work);
        return {
          demand: need,
          repaying: stage === "recovery" ? point.uptake : null,
          resting: stage === "recovery" ? rest : null,
          short: stage === "exercise" ? point.uptake : null,
          uptake: point.uptake,
          wanted: stage === "exercise" ? need : null,
          x: point.minute,
        };
      }),
    [rest, work]
  );
  const quantity = useQuantity();
  const level = lactic(minute, work, range.max);
  const rate = "\\text{ L min}^{-1}";

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setWork(range.value);
          setMinute(OPENING);
        }}
      />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.demand}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(work, rate, 1)} />
            </span>
          </div>
          <Slider
            aria-label={labels.demand}
            max={range.max}
            min={range.min}
            onValueChange={(value: number) => setWork(value)}
            step={DEMAND_STEP}
            value={work}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.time}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(minute, "\\text{ min}", 1)} />
            </span>
          </div>
          <HandSlider
            label={labels.time}
            max={RUN.close}
            onChange={setMinute}
            step={0.25}
            value={minute}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={22} setting="studio">
          <Suspense fallback={null}>
            <PoseProvider
              elapsed={minute}
              most={range.max}
              onElapsed={setMinute}
              rest={rest}
              work={work}
            >
              <MuscleScene labels={labels.parts} />
            </PoseProvider>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <BiologyTrace
          bands={[
            {
              color: MUSCLE_COLORS.lactate,
              high: "wanted",
              low: "short",
              opacity: 0.4,
            },
            {
              color: MUSCLE_COLORS.oxygen,
              high: "repaying",
              low: "resting",
              opacity: 0.24,
            },
          ]}
          cursor={{ x: minute, y: uptake(minute, rest, work) }}
          rows={rows}
          series={[
            {
              color: MUSCLE_COLORS.oxygen,
              key: "uptake",
              label: (
                <>
                  {labels.uptake} <InlineMath math="(\text{L min}^{-1})" />
                </>
              ),
            },
            {
              color: PLOT_COLORS.slate,
              dashed: true,
              key: "demand",
              label: labels.need,
            },
          ]}
          ticks={Arr.range(0, Math.ceil(rest + range.max))}
          top={Math.ceil(rest + range.max)}
          xLabel={`${labels.time} (min)`}
        />
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={MUSCLE_COLORS.oxygen}
            label={labels.uptake}
            value={
              <InlineMath
                math={quantity(uptake(minute, rest, work), rate, 2)}
              />
            }
          />
          {labels.need === undefined ? null : (
            <VisualFactTabular
              label={labels.need}
              value={
                <InlineMath
                  math={quantity(demand(minute, rest, work), rate, 2)}
                />
              }
            />
          )}
          <VisualFactIndicator
            indicatorColor={MUSCLE_COLORS.lactate}
            label={labels.shortfall}
            value={
              <InlineMath
                math={quantity(shortfall(minute, work), "\\text{ L}", 2)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={MUSCLE_COLORS.oxygen}
            label={labels.debt}
            value={
              <InlineMath
                math={quantity(repaid(minute, work), "\\text{ L}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.lactic}
            value={
              <LacticGauge level={level}>
                <InlineMath math={quantity(level, "", 2)} />
              </LacticGauge>
            }
          />
          {labels.force === undefined ? null : (
            <VisualFactTabular
              label={labels.force}
              value={
                <InlineMath math={quantity(force(level) * 100, "\\,\\%", 0)} />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
