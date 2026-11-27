import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { GasCondition } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import { evaluateAvogadroGas } from "@repo/design-system/components/contents/chemistry/avogadro/model";
import { AvogadroGasScene } from "@repo/design-system/components/contents/chemistry/avogadro/scene";
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

export function AvogadroGasVolumeLab({
  conditions,
  description,
  labels,
  moles,
  title,
}: {
  readonly conditions: readonly [GasCondition, ...GasCondition[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly condition: string;
    readonly conditions: Readonly<
      Partial<
        Record<
          GasCondition,
          { readonly molarVolume: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly gasVolume?: ReactNode;
    readonly moles: string;
    readonly particleCount?: ReactNode;
    readonly parts: Readonly<
      Record<
        "cylinder" | "gasParticles" | "piston" | "thermometer" | "volumeScale",
        string
      >
    >;
    readonly view: string;
  };
  readonly moles: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<GasCondition>(conditions[0]);
  const [molVal, setMolVal] = useState(moles.value);
  const quantity = useQuantity();

  const active = Arr.contains(conditions, selected) ? selected : conditions[0];
  const reading = evaluateAvogadroGas(active, molVal);
  const copy = labels.conditions[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(conditions[0]);
          setMolVal(moles.value);
        }}
      />

      <VisualCardToolbar>
        {conditions.length > 1 ? (
          <ToggleGroup
            aria-label={labels.condition}
            gridColumns={toggleColumns(conditions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(conditions, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(conditions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.conditions[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.moles}
          label={labels.moles}
          max={moles.max}
          min={moles.min}
          onValueChange={setMolVal}
          readout={<InlineMath math={quantity(molVal, "\\text{ mol}", 2)} />}
          step={Math.max(0.05, (moles.max - moles.min) / 40)}
          value={molVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.2} setting="lab">
          <Suspense fallback={null}>
            <AvogadroGasScene
              condition={active}
              moles={molVal}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.condition} value={copy.molarVolume} />
          )}
          {labels.gasVolume === undefined ? null : (
            <VisualFactTabular
              label={labels.gasVolume}
              value={
                <InlineMath
                  math={quantity(reading.volumeDm3, "\\text{ dm}^3", 1)}
                />
              }
            />
          )}
          {labels.particleCount === undefined ? null : (
            <VisualFactTabular
              label={labels.particleCount}
              value={<InlineMath math={reading.moleculesMath} />}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
