import {
  carbonDioxideOut,
  gasFlow,
  gasOut,
  madeAt,
  molarVolume,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  bubbleRate,
  chalkAt,
  isMilky,
  milkiness,
} from "@repo/design-system/components/contents/biology/yeast/limewater";
import {
  RUN_MINUTES,
  YeastScene,
} from "@repo/design-system/components/contents/biology/yeast/scene";
import { riseAt } from "@repo/design-system/components/contents/biology/yeast/warmth";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/**
 * The KSSM experiment on fermentation in yeast and its control. Two boiling
 * tubes of boiled and cooled glucose solution under paraffin oil stand in one
 * water bath; one has yeast. Its carbon dioxide first dissolves, then bubbles
 * through limewater, which turns milky with calcium carbonate, while its
 * thermometer creeps a fraction of a degree above the control's. The control
 * stays still and its limewater clear. The learner sets the bath and runs
 * the hour, in which the yeast works fastest near 32 °C and stops above 45 °C.
 */
export function YeastFermentationLab({
  description,
  glucose,
  labels,
  temperature,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly glucose: number;
  readonly labels: {
    readonly clear: ReactNode;
    readonly collected: ReactNode;
    readonly control: string;
    readonly ethanol: ReactNode;
    readonly limewater: ReactNode;
    readonly milky: ReactNode;
    readonly none: ReactNode;
    readonly parts: {
      readonly bath: string;
      readonly limewater: string;
      readonly paraffin: string;
      readonly thermometer: string;
    };
    readonly rate: ReactNode;
    readonly smell: ReactNode;
    readonly temperature: string;
    readonly time: string;
    readonly view: string;
    readonly warmth: ReactNode;
    readonly yeast: string;
  };
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [celsius, setCelsius] = useState(temperature.value);
  const [elapsed, setElapsed] = useState(RUN_MINUTES);
  const quantity = useQuantity();
  const flow = gasFlow(celsius, glucose, elapsed);
  const gas = gasOut(celsius, glucose, elapsed);
  const delivered = carbonDioxideOut(gas);
  const cloud = milkiness(chalkAt(delivered / molarVolume(celsius)));
  const warm = celsius + riseAt(celsius, glucose, elapsed);
  const words = useMemo(
    () => ({ ...labels.parts, control: labels.control, yeast: labels.yeast }),
    [labels.control, labels.parts, labels.yeast]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.temperature}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(celsius, UNIT.temperature, 0)} />
            </span>
          </div>
          <Slider
            aria-label={labels.temperature}
            max={temperature.max}
            min={temperature.min}
            onValueChange={(value: number) => setCelsius(value)}
            step={1}
            value={celsius}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.time}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(elapsed, "\\text{ min}", 0)} />
            </span>
          </div>
          <HandSlider
            label={labels.time}
            max={RUN_MINUTES}
            onChange={setElapsed}
            step={RUN_MINUTES / 120}
            value={elapsed}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.35} setting="lab">
          <Suspense fallback={null}>
            <YeastScene
              celsius={celsius}
              elapsed={elapsed}
              onElapsed={setElapsed}
              percent={glucose}
              words={words}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.rate}
            value={
              <InlineMath
                math={quantity(bubbleRate(flow), "\\text{ min}^{-1}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.collected}
            value={
              <InlineMath math={quantity(delivered, "\\text{ cm}^3", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.limewater}
            value={
              <TubePair
                control={labels.clear}
                names={[labels.yeast, labels.control]}
                yeast={isMilky(cloud) ? labels.milky : labels.clear}
              />
            }
          />
          <VisualFactTabular
            label={labels.warmth}
            value={
              <TubePair
                control={
                  <InlineMath math={quantity(celsius, UNIT.temperature, 1)} />
                }
                names={[labels.yeast, labels.control]}
                yeast={
                  <InlineMath math={quantity(warm, UNIT.temperature, 1)} />
                }
              />
            }
          />
          <VisualFactTabular
            label={labels.smell}
            value={
              madeAt(celsius, glucose, elapsed) > 0
                ? labels.ethanol
                : labels.none
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** One reading for each tube, each line led by the tube's name. */
function TubePair({
  control,
  names,
  yeast,
}: {
  readonly control: ReactNode;
  readonly names: readonly [string, string];
  readonly yeast: ReactNode;
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>
        <span className="text-muted-foreground">{names[0]}: </span>
        {yeast}
      </span>
      <span>
        <span className="text-muted-foreground">{names[1]}: </span>
        {control}
      </span>
    </span>
  );
}
