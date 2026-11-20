import {
  cardiacOutput,
  heartBeat,
  momentAt,
  phaseOf,
  RATES,
  stageAt,
  strokeVolume,
} from "@repo/design-system/components/contents/biology/heart/cycle";
import { HeartScene } from "@repo/design-system/components/contents/biology/heart/scene";
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
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useDeferredValue, useMemo, useState } from "react";

/**
 * A human heart cut open from the front, beating through the cardiac cycle
 * at the chosen heart rate. The left ventricle fills to
 * `volumes.endDiastolic` and empties to `volumes.endSystolic` millilitres;
 * a lumped model of the left heart and the arteries sets its pressures, and
 * the valves open and shut on those pressures. The footer reads out the
 * phase, the pressures in the left ventricle and the aorta, the ventricle's
 * volume, and, when the lesson gives their labels, the stroke volume and
 * the cardiac output.
 */
export function HeartCycleLab({
  description,
  labels,
  rate,
  title,
  volumes,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly aorta: ReactNode;
    readonly output?: ReactNode;
    readonly phase: ReactNode;
    readonly phases: Readonly<{
      atrial: ReactNode;
      diastole: ReactNode;
      ventricular: ReactNode;
    }>;
    readonly pressure: ReactNode;
    readonly rate: string;
    readonly stroke?: ReactNode;
    readonly view: string;
    readonly volume: ReactNode;
  };
  readonly rate: number;
  readonly title: NonNullable<ReactNode>;
  readonly volumes: Readonly<{ endDiastolic: number; endSystolic: number }>;
}) {
  const quantity = useQuantity();
  const [heartRate, setHeartRate] = useState(rate);
  const shownRate = useDeferredValue(heartRate);
  const { endDiastolic, endSystolic } = volumes;
  const beat = useMemo(
    () => heartBeat(shownRate, { endDiastolic, endSystolic }),
    [shownRate, endDiastolic, endSystolic]
  );
  // A still heart opens early in diastole: the atrioventricular valves open
  // and the ventricles filling, the semilunar valves shut on the arteries.
  const [time, setTime] = useState(
    () => beat.events.refill + 0.25 * (beat.events.atrium - beat.events.refill)
  );
  const moment = momentAt(beat, time);
  const phase = phaseOf(stageAt(beat.events, moment.time));
  const stroke = strokeVolume(volumes);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.rate}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(heartRate, "\\text{ min}^{-1}", 0)} />
            </span>
          </div>
          <Slider
            aria-label={labels.rate}
            max={RATES.maximum}
            min={RATES.minimum}
            onValueChange={(value: number) => setHeartRate(value)}
            step={1}
            value={heartRate}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={11} setting="studio">
          <Suspense fallback={null}>
            <HeartScene beat={beat} onTime={setTime} time={time} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.phase} value={labels.phases[phase]} />
          <VisualFactTabular
            label={labels.pressure}
            value={
              <InlineMath
                math={quantity(moment.ventricle, "\\text{ mmHg}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.aorta}
            value={
              <InlineMath math={quantity(moment.aorta, "\\text{ mmHg}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.volume}
            value={
              <InlineMath math={quantity(moment.volume, "\\text{ cm}^3", 0)} />
            }
          />
          {labels.stroke !== undefined && (
            <VisualFactTabular
              label={labels.stroke}
              value={
                <InlineMath
                  math={`${quantity(endDiastolic, "", 0)} - ${quantity(endSystolic, "", 0)} = ${quantity(stroke, "\\text{ cm}^3", 0)}`}
                />
              }
            />
          )}
          {labels.output !== undefined && (
            <VisualFactTabular
              label={labels.output}
              value={
                <InlineMath
                  math={`${quantity(stroke, "", 0)} \\times ${quantity(shownRate, "", 0)} = ${quantity(cardiacOutput(volumes, shownRate), "\\text{ dm}^3\\text{ min}^{-1}", 2)}`}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
