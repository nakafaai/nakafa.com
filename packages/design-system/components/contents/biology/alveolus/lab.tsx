import type { ActivityState } from "@repo/design-system/components/contents/biology/alveolus/model";
import { evaluateAlveolusExchange } from "@repo/design-system/components/contents/biology/alveolus/model";
import { AlveolusGasExchangeScene } from "@repo/design-system/components/contents/biology/alveolus/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function AlveolusGasExchangeLab({
  description,
  labels,
  states,
  title,
  ventilation,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly diffusionRate?: ReactNode;
    readonly oxygenUptake?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "alveolus"
        | "capillary"
        | "carbonDioxide"
        | "oxygen"
        | "redBloodCell"
        | "surfactantFilm",
        string
      >
    >;
    readonly state: string;
    readonly states: Readonly<
      Partial<
        Record<
          ActivityState,
          { readonly name: ReactNode; readonly summary: ReactNode }
        >
      >
    >;
    readonly ventilation: string;
    readonly view: string;
  };
  readonly states: readonly [ActivityState, ...ActivityState[]];
  readonly title: NonNullable<ReactNode>;
  readonly ventilation: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
}) {
  const [selected, setSelected] = useState<ActivityState>(states[0]);
  const [rate, setRate] = useState(ventilation.value);
  const quantity = useQuantity();

  const active = Arr.contains(states, selected) ? selected : states[0];
  const reading = evaluateAlveolusExchange(active, rate);
  const copy = labels.states[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(states[0]);
          setRate(ventilation.value);
        }}
      />

      <VisualCardToolbar>
        {states.length > 1 ? (
          <ToggleGroup
            aria-label={labels.state}
            gridColumns={toggleColumns(states.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(states, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(states, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.states[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.ventilation}
          label={labels.ventilation}
          max={ventilation.max}
          min={ventilation.min}
          onValueChange={setRate}
          readout={<InlineMath math={quantity(rate, "\\text{ min}^{-1}", 0)} />}
          step={1}
          value={rate}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={2.6} setting="studio">
          <Suspense fallback={null}>
            <AlveolusGasExchangeScene
              parts={labels.parts}
              state={active}
              ventilation={rate}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.state} value={copy.summary} />
          )}
          {labels.oxygenUptake === undefined ? null : (
            <VisualFactTabular
              label={labels.oxygenUptake}
              value={
                <InlineMath
                  math={quantity(
                    reading.oxygenUptakeMlPerMin,
                    "\\text{ mL min}^{-1}",
                    0
                  )}
                />
              }
            />
          )}
          {labels.diffusionRate === undefined ? null : (
            <VisualFactTabular
              label={labels.diffusionRate}
              value={
                <InlineMath
                  math={quantity(reading.pO2GradientMmHg, "\\text{ mmHg}", 0)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
