import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { CalorimeterMaterial } from "@repo/design-system/components/contents/physics/calorimeter/model";
import { evaluateCalorimeter } from "@repo/design-system/components/contents/physics/calorimeter/model";
import { CalorimeterScene } from "@repo/design-system/components/contents/physics/calorimeter/scene";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function SpecificHeatCalorimeterLab({
  description,
  labels,
  mass,
  materials,
  minutes,
  power,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly energy: ReactNode;
    readonly mass: string;
    readonly material: string;
    readonly materials: Readonly<Partial<Record<CalorimeterMaterial, string>>>;
    readonly parts: Readonly<
      Record<
        "heater" | "insulation" | "sample" | "stirrer" | "thermometer",
        string
      >
    >;
    readonly power: string;
    readonly specificHeat?: ReactNode;
    readonly temperatureRise?: ReactNode;
    readonly time: string;
    readonly view: string;
  };
  readonly mass: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly materials: readonly [CalorimeterMaterial, ...CalorimeterMaterial[]];
  readonly minutes: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly power: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<CalorimeterMaterial>(materials[0]);
  const [massVal, setMassVal] = useState(mass.value);
  const [powerVal, setPowerVal] = useState(power.value);
  const [timeVal, setTimeVal] = useState(minutes.value);
  const quantity = useQuantity();

  const active = Arr.contains(materials, selected) ? selected : materials[0];
  const reading = evaluateCalorimeter(active, massVal, powerVal, timeVal);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(materials[0]);
          setMassVal(mass.value);
          setPowerVal(power.value);
          setTimeVal(minutes.value);
        }}
      />

      <VisualCardToolbar>
        {materials.length > 1 ? (
          <ToggleGroup
            aria-label={labels.material}
            gridColumns={toggleColumns(materials.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(materials, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(materials, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.materials[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.mass}
          label={labels.mass}
          max={mass.max}
          min={mass.min}
          onValueChange={setMassVal}
          readout={<InlineMath math={quantity(massVal, "\\text{ kg}", 2)} />}
          step={0.1}
          value={massVal}
        />
        <VisualSlider
          heading={labels.power}
          label={labels.power}
          max={power.max}
          min={power.min}
          onValueChange={setPowerVal}
          readout={<InlineMath math={quantity(powerVal, "\\text{ W}", 0)} />}
          step={10}
          value={powerVal}
        />
        <VisualSlider
          heading={labels.time}
          label={labels.time}
          max={minutes.max}
          min={minutes.min}
          onValueChange={setTimeVal}
          readout={<InlineMath math={quantity(timeVal, "\\text{ min}", 1)} />}
          step={0.5}
          value={timeVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <CalorimeterScene
              material={active}
              parts={labels.parts}
              temperatureRiseK={reading.temperatureRiseK}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath
                math={quantity(reading.energyJ / 1000, "\\text{ kJ}", 2)}
              />
            }
          />
          {labels.specificHeat === undefined ? null : (
            <VisualFactTabular
              label={labels.specificHeat}
              value={
                <InlineMath
                  math={quantity(
                    reading.specificHeatJPerKgK,
                    "\\text{ J kg}^{-1}\\text{K}^{-1}",
                    0
                  )}
                />
              }
            />
          )}
          {labels.temperatureRise === undefined ? null : (
            <VisualFactTabular
              label={labels.temperatureRise}
              value={
                <InlineMath
                  math={quantity(reading.temperatureRiseK, "\\text{ K}", 1)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
