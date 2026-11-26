import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { EnthalpyReaction } from "@repo/design-system/components/contents/chemistry/enthalpy/model";
import { evaluateCalorimeter } from "@repo/design-system/components/contents/chemistry/enthalpy/model";
import { CalorimeterEnthalpyScene } from "@repo/design-system/components/contents/chemistry/enthalpy/scene";
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

export function CalorimeterEnthalpyLab({
  description,
  labels,
  moles,
  reactions,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly deltaH?: ReactNode;
    readonly moles: string;
    readonly parts: Readonly<
      Record<
        "cup" | "heatArrow" | "solution" | "stirrer" | "thermometer",
        string
      >
    >;
    readonly reaction: string;
    readonly reactions: Readonly<
      Partial<
        Record<
          EnthalpyReaction,
          {
            readonly enthalpySign: ReactNode;
            readonly name: string;
            readonly thermalNote: ReactNode;
          }
        >
      >
    >;
    readonly tempChange?: ReactNode;
    readonly view: string;
  };
  readonly moles: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly reactions: readonly [EnthalpyReaction, ...EnthalpyReaction[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<EnthalpyReaction>(reactions[0]);
  const [molVal, setMolVal] = useState(moles.value);
  const quantity = useQuantity();

  const active = Arr.contains(reactions, selected) ? selected : reactions[0];
  const reading = evaluateCalorimeter(active, molVal);
  const copy = labels.reactions[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(reactions[0]);
          setMolVal(moles.value);
        }}
      />

      <VisualCardToolbar>
        {reactions.length > 1 ? (
          <ToggleGroup
            aria-label={labels.reaction}
            gridColumns={toggleColumns(reactions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(reactions, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(reactions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.reactions[id]?.name ?? id}
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
          step={Math.max(0.01, (moles.max - moles.min) / 50)}
          value={molVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <CalorimeterEnthalpyScene
              moles={molVal}
              parts={labels.parts}
              reaction={active}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.reaction} value={copy.thermalNote} />
          )}
          {labels.deltaH === undefined ? null : (
            <VisualFactTabular
              label={labels.deltaH}
              value={
                <InlineMath
                  math={quantity(
                    reading.deltaHKjPerMol,
                    "\\text{ kJ mol}^{-1}",
                    1
                  )}
                />
              }
            />
          )}
          {labels.tempChange === undefined ? null : (
            <VisualFactTabular
              label={labels.tempChange}
              value={
                <InlineMath
                  math={quantity(reading.tempChangeC, "^\\circ\\text{C}", 1)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
