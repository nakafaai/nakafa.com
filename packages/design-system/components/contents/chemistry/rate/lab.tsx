import {
  type Solid,
  TIME_SPAN,
} from "@repo/design-system/components/contents/chemistry/rate/curve";
import {
  Board,
  RateScene,
  RUN_COLORS,
} from "@repo/design-system/components/contents/chemistry/rate/scene";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useState } from "react";
import { useFormatter } from "use-intl";

/** Numbers in a reading keep three significant figures, as SPM working does. */
const READING = { maximumSignificantDigits: 3, useGrouping: false } as const;

/** The words a gas-rate lab reads from its document. */
interface RateLabels {
  /** The fact label for a run's final amount of gas. */
  readonly final: ReactNode;
  /** One name per run, shown under its flask, on the graph and in the footer. */
  readonly runs: Arr.NonEmptyReadonlyArray<ReactNode>;
  /** Each form of the solid, in words. */
  readonly solids: Record<Solid, ReactNode>;
  /** The time slider's name and the graph's time axis. */
  readonly time: string;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Up to two runs of a reaction that gives off a gas, each a conical flask
 * stoppered to a gas syringe. The set-up alone suits a question. With
 * `showCurves`, which an explanation sets, a slider runs time on: the
 * plungers move out as gas collects, and a board plots each run's amount
 * against time, steeper at the start for a finer solid and levelling off at
 * the final amount the limiting reactant allows. Only the final amounts are
 * data; the time axis carries no numbers, because the steepness is a model.
 *
 * @param runs - Each run's solid and its final amount of gas in mol
 * @param showCurves - Whether the slider, the plungers' travel and the graph show
 */
export function GasRateLab({
  description,
  labels,
  runs,
  showCurves = false,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: RateLabels;
  readonly runs: Arr.NonEmptyReadonlyArray<{
    readonly amount: number;
    readonly solid: Solid;
  }>;
  readonly showCurves?: boolean;
  readonly title: NonNullable<ReactNode>;
}) {
  const [time, setTime] = useState(TIME_SPAN * 0.25);
  const format = useFormatter();
  const number = (value: number) => mathNumber(format.number(value, READING));
  const drawn = Arr.map(runs, (run, index) => ({
    ...run,
    amountTex: `${number(run.amount)}`,
    label: labels.runs[index],
  }));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {showCurves ? (
        <VisualCardToolbar>
          <div className="flex w-full flex-col gap-3">
            <span className="text-sm">{labels.time}</span>
            <HandSlider
              label={labels.time}
              max={TIME_SPAN}
              onChange={setTime}
              step={0.01}
              value={time}
            />
          </div>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={0.8} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0, 0.32, 1.08]}
              cameraTarget={[0, 0.16, 0]}
              fov={36}
              maxDistance={2}
              minDistance={0.3}
            />
            <RateScene runs={drawn} showCurves={showCurves} time={time}>
              {showCurves ? (
                <Board runs={drawn} time={time} timeLabel={labels.time} />
              ) : null}
            </RateScene>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(drawn, (run, index) => (
            <VisualFactIndicator
              indicatorColor={
                showCurves ? RUN_COLORS[index === 0 ? 0 : 1] : undefined
              }
              key={String(index)}
              label={run.label}
              value={
                showCurves ? (
                  <>
                    {labels.solids[run.solid]}, {labels.final}{" "}
                    <InlineMath math={`${run.amountTex}\\text{ mol}`} />
                  </>
                ) : (
                  labels.solids[run.solid]
                )
              }
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
