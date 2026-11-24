import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { ThermalCondition } from "@repo/design-system/components/contents/biology/skin/model";
import { evaluateSkin } from "@repo/design-system/components/contents/biology/skin/model";
import { SkinThermoregulationScene } from "@repo/design-system/components/contents/biology/skin/scene";
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

export function ThermoregulationSkinLab({
  ambient,
  conditions,
  description,
  labels,
  title,
}: {
  readonly ambient: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly conditions: readonly [ThermalCondition, ...ThermalCondition[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly ambient: string;
    readonly bloodFlow?: ReactNode;
    readonly condition: string;
    readonly conditions: Readonly<Partial<Record<ThermalCondition, string>>>;
    readonly heatLoss?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "arteriole"
        | "capillary"
        | "epidermis"
        | "erectorMuscle"
        | "fatLayer"
        | "hairShaft"
        | "sweatGland",
        string
      >
    >;
    readonly response: ReactNode;
    readonly responses: Readonly<Partial<Record<ThermalCondition, ReactNode>>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<ThermalCondition>(conditions[0]);
  const [ambientC, setAmbientC] = useState(ambient.value);
  const quantity = useQuantity();

  const active = Arr.contains(conditions, selected) ? selected : conditions[0];
  const reading = evaluateSkin(active, ambientC);
  const responseCopy = labels.responses[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(conditions[0]);
          setAmbientC(ambient.value);
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
                {labels.conditions[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.ambient}
          label={labels.ambient}
          max={ambient.max}
          min={ambient.min}
          onValueChange={setAmbientC}
          readout={
            <InlineMath math={quantity(ambientC, "^\\circ\\text{C}", 0)} />
          }
          step={1}
          value={ambientC}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.3} setting="lab">
          <Suspense fallback={null}>
            <SkinThermoregulationScene
              ambientC={ambientC}
              condition={active}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {responseCopy === undefined ? null : (
            <VisualFact label={labels.response} value={responseCopy} />
          )}
          {labels.bloodFlow === undefined ? null : (
            <VisualFactTabular
              label={labels.bloodFlow}
              value={`${reading.bloodFlowPercent}%`}
            />
          )}
          {labels.heatLoss === undefined ? null : (
            <VisualFactTabular
              label={labels.heatLoss}
              value={`${reading.heatLossPercent}%`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
