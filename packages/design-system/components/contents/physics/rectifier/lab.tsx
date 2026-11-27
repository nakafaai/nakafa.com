import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { RectifierMode } from "@repo/design-system/components/contents/physics/rectifier/model";
import { evaluateRectifier } from "@repo/design-system/components/contents/physics/rectifier/model";
import { RectifierScene } from "@repo/design-system/components/contents/physics/rectifier/scene";
import { RectifierTrace } from "@repo/design-system/components/contents/physics/rectifier/trace";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function RectifierDiodeLab({
  description,
  frequency,
  labels,
  modes,
  peakVoltage,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly frequency: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly conduction?: ReactNode;
    readonly frequency: string;
    readonly inputWave: ReactNode;
    readonly mode: string;
    readonly modes: Readonly<Partial<Record<RectifierMode, string>>>;
    readonly outputWave: ReactNode;
    readonly parts: Readonly<
      Record<
        | "acSource"
        | "capacitor"
        | "diodeBridge"
        | "loadResistor"
        | "oscilloscope",
        string
      >
    >;
    readonly ripple?: ReactNode;
    readonly view: string;
  };
  readonly modes: readonly [RectifierMode, ...RectifierMode[]];
  readonly peakVoltage: number;
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<RectifierMode>(modes[0]);
  const [freq, setFreq] = useState(frequency.value);
  const quantity = useQuantity();

  const active = Arr.contains(modes, selected) ? selected : modes[0];
  const reading = evaluateRectifier(active, peakVoltage, freq);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(modes[0]);
          setFreq(frequency.value);
        }}
      />

      <VisualCardToolbar>
        {modes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.mode}
            gridColumns={toggleColumns(modes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(modes, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(modes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.modes[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.frequency}
          label={labels.frequency}
          max={frequency.max}
          min={frequency.min}
          onValueChange={setFreq}
          readout={<InlineMath math={quantity(freq, "\\text{ Hz}", 0)} />}
          step={1}
          value={freq}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <RectifierScene
              frequency={freq}
              mode={active}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <RectifierTrace
          inputLabel={labels.inputWave}
          mode={active}
          outputLabel={labels.outputWave}
        />
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={QUANTUM_COLORS.dcWave}
            label={labels.outputWave}
            value={
              <InlineMath math={quantity(reading.dcAverage, "\\text{ V}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.inputWave}
            value={<InlineMath math={quantity(peakVoltage, "\\text{ V}", 1)} />}
          />
          {labels.conduction === undefined ? null : (
            <VisualFactTabular
              label={labels.conduction}
              value={`${reading.activeDiodes}`}
            />
          )}
          {labels.ripple === undefined ? null : (
            <VisualFactTabular
              label={labels.ripple}
              value={
                <InlineMath math={quantity(reading.ripplePercent, "\\%", 0)} />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
