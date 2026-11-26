import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { TrophicScenario } from "@repo/design-system/components/contents/biology/trophic/model";
import { evaluateTrophicPyramid } from "@repo/design-system/components/contents/biology/trophic/model";
import { FoodWebTrophicScene } from "@repo/design-system/components/contents/biology/trophic/scene";
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

export function FoodWebTrophicLab({
  description,
  energyInput,
  labels,
  scenarios,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly energyInput: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly energyCascade?: ReactNode;
    readonly energyInput: string;
    readonly outcome?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "decomposer"
        | "heatLoss"
        | "primaryConsumer"
        | "producer"
        | "secondaryConsumer"
        | "tertiaryConsumer",
        string
      >
    >;
    readonly scenario: string;
    readonly scenarios: Readonly<
      Partial<
        Record<
          TrophicScenario,
          { readonly effect: ReactNode; readonly name: string }
        >
      >
    >;
    readonly view: string;
  };
  readonly scenarios: readonly [TrophicScenario, ...TrophicScenario[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<TrophicScenario>(scenarios[0]);
  const [energy, setEnergy] = useState(energyInput.value);
  const quantity = useQuantity();

  const active = Arr.contains(scenarios, selected) ? selected : scenarios[0];
  const reading = evaluateTrophicPyramid(active, energy);
  const copy = labels.scenarios[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(scenarios[0]);
          setEnergy(energyInput.value);
        }}
      />

      <VisualCardToolbar>
        {scenarios.length > 1 ? (
          <ToggleGroup
            aria-label={labels.scenario}
            gridColumns={toggleColumns(scenarios.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(scenarios, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(scenarios, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.scenarios[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.energyInput}
          label={labels.energyInput}
          max={energyInput.max}
          min={energyInput.min}
          onValueChange={setEnergy}
          readout={<InlineMath math={quantity(energy, "\\text{ kJ}", 0)} />}
          step={Math.max(
            100,
            Math.round((energyInput.max - energyInput.min) / 40)
          )}
          value={energy}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="grass" reach={3.1} setting="field">
          <Suspense fallback={null}>
            <FoodWebTrophicScene
              energyInput={energy}
              parts={labels.parts}
              scenario={active}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.scenario} value={copy.effect} />
          )}
          {labels.energyCascade === undefined ? null : (
            <VisualFactTabular
              label={labels.energyCascade}
              value={
                <InlineMath
                  math={`${Math.round(reading.producerKj)} \\to ${Math.round(reading.primaryKj)} \\to ${Math.round(reading.secondaryKj)} \\to ${Math.round(reading.tertiaryKj)}\\text{ kJ}`}
                />
              }
            />
          )}
          {labels.outcome === undefined ? null : (
            <VisualFact label={labels.outcome} value={copy?.name ?? active} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
