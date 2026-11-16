import {
  dropTravel,
  quotient,
  type Substrate,
  substrateOf,
} from "@repo/design-system/components/contents/biology/respirometer/gas";
import { RespirometerScene } from "@repo/design-system/components/contents/biology/respirometer/scene";
import { HandSlider } from "@repo/design-system/components/contents/chemistry/slider";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { type ReactNode, Suspense, useState } from "react";

/**
 * Two respirometers with the same germinating seeds in one water bath: one
 * over potassium hydroxide solution, which absorbs carbon dioxide, and one
 * over water. In each, a drop of coloured liquid in the capillary creeps
 * towards the seeds. Over potassium hydroxide it moves by the oxygen taken
 * in; over water by the oxygen taken in less the carbon dioxide given off.
 * The difference is the carbon dioxide, and their ratio the respiratory
 * quotient.
 */
export function RespirometerLab({
  carbonDioxide,
  description,
  labels,
  minutes,
  oxygen,
  title,
}: {
  readonly carbonDioxide: number;
  readonly description: ReactNode;
  readonly labels: {
    readonly potash: ReactNode;
    readonly quotient: ReactNode;
    readonly substrate: ReactNode;
    readonly substrates: Readonly<Record<Substrate, ReactNode>>;
    readonly time: string;
    readonly view: string;
    readonly water: ReactNode;
  };
  readonly minutes: number;
  readonly oxygen: number;
  readonly title: ReactNode;
}) {
  const [elapsed, setElapsed] = useState(minutes);
  const quantity = useQuantity();
  const potash = dropTravel("potash", oxygen, carbonDioxide, elapsed, minutes);
  const water = dropTravel("water", oxygen, carbonDioxide, elapsed, minutes);
  const ratio = quotient(oxygen, carbonDioxide);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.time}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={quantity(elapsed, "\\text{ min}", 1)} />
            </span>
          </div>
          <HandSlider
            label={labels.time}
            max={minutes}
            onChange={setElapsed}
            step={minutes / 40}
            value={elapsed}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.45} setting="lab">
          <Suspense fallback={null}>
            <RespirometerScene
              carbonDioxide={carbonDioxide}
              elapsed={elapsed}
              minutes={minutes}
              onElapsed={setElapsed}
              oxygen={oxygen}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.potash}
            value={<InlineMath math={quantity(potash, "\\text{ mm}", 1)} />}
          />
          <VisualFactTabular
            label={labels.water}
            value={<InlineMath math={quantity(water, "\\text{ mm}", 1)} />}
          />
          <VisualFactTabular
            label={labels.quotient}
            value={
              <InlineMath
                math={`\\text{RQ} = \\dfrac{${quantity(oxygen, "", 1)} - ${quantity(oxygen - carbonDioxide, "", 1)}}{${quantity(oxygen, "", 1)}} = ${quantity(ratio, "", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.substrate}
            value={labels.substrates[substrateOf(ratio)]}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
