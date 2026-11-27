import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { evaluateHaberConverter } from "@repo/design-system/components/contents/chemistry/haber/model";
import { HaberConverterScene } from "@repo/design-system/components/contents/chemistry/haber/scene";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function HaberAmmoniaConverterLab({
  description,
  labels,
  pressure,
  temperature,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly equilibriumYield?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "compressor"
        | "coolingCondenser"
        | "ironCatalystBed"
        | "liquidAmmonia"
        | "recyclePipe",
        string
      >
    >;
    readonly pressure: string;
    readonly rateNote?: ReactNode;
    readonly temperature: string;
    readonly view: string;
  };
  readonly pressure: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [tempVal, setTempVal] = useState(temperature.value);
  const [pressVal, setPressVal] = useState(pressure.value);
  const quantity = useQuantity();
  const reading = evaluateHaberConverter(tempVal, pressVal);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setTempVal(temperature.value);
          setPressVal(pressure.value);
        }}
      />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.temperature}
          label={labels.temperature}
          max={temperature.max}
          min={temperature.min}
          onValueChange={setTempVal}
          readout={
            <InlineMath math={quantity(tempVal, "^\\circ\\text{C}", 0)} />
          }
          step={10}
          value={tempVal}
        />

        <VisualSlider
          heading={labels.pressure}
          label={labels.pressure}
          max={pressure.max}
          min={pressure.min}
          onValueChange={setPressVal}
          readout={<InlineMath math={quantity(pressVal, "\\text{ atm}", 0)} />}
          step={10}
          value={pressVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.3} setting="lab">
          <Suspense fallback={null}>
            <HaberConverterScene
              parts={labels.parts}
              pressureAtm={pressVal}
              temperatureC={tempVal}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.pressure}
            value={<InlineMath math={quantity(pressVal, "\\text{ atm}", 0)} />}
          />
          {labels.equilibriumYield === undefined ? null : (
            <VisualFactTabular
              label={labels.equilibriumYield}
              value={
                <InlineMath math={quantity(reading.yieldPercent, "\\%", 0)} />
              }
            />
          )}
          {labels.rateNote === undefined ? null : (
            <VisualFactTabular
              label={labels.rateNote}
              value={
                <InlineMath math={quantity(reading.relativeRate, "\\%", 0)} />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
