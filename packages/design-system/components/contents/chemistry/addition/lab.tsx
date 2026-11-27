import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { AdditionMonomer } from "@repo/design-system/components/contents/chemistry/addition/model";
import { AdditionPolymerScene } from "@repo/design-system/components/contents/chemistry/addition/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function AdditionPolymerChainLab({
  chainLength,
  description,
  labels,
  monomers,
  title,
}: {
  readonly chainLength: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly chainLength: string;
    readonly monomer: string;
    readonly monomers: Readonly<
      Partial<
        Record<
          AdditionMonomer,
          {
            readonly name: ReactNode;
            readonly polymerName: ReactNode;
            readonly repeatUnit: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "doubleBond" | "monomerUnit" | "sideGroup" | "singleBackbone",
        string
      >
    >;
    readonly polymerName?: ReactNode;
    readonly repeatUnit?: ReactNode;
    readonly view: string;
  };
  readonly monomers: readonly [AdditionMonomer, ...AdditionMonomer[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<AdditionMonomer>(monomers[0]);
  const [units, setUnits] = useState(chainLength.value);

  const active = Arr.contains(monomers, selected) ? selected : monomers[0];
  const copy = labels.monomers[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(monomers[0]);
          setUnits(chainLength.value);
        }}
      />

      <VisualCardToolbar>
        {monomers.length > 1 ? (
          <ToggleGroup
            aria-label={labels.monomer}
            gridColumns={toggleColumns(monomers.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(monomers, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(monomers, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.monomers[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.chainLength}
          label={labels.chainLength}
          max={chainLength.max}
          min={chainLength.min}
          onValueChange={setUnits}
          readout={`${Math.round(units)}`}
          step={1}
          value={units}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.15} setting="lab">
          <Suspense fallback={null}>
            <AdditionPolymerScene
              chainLength={units}
              monomer={active}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={ORGANIC_COLORS.doubleBondGold}
            label={labels.monomer}
            value={copy?.name ?? active}
          />
          {labels.polymerName === undefined || copy === undefined ? null : (
            <VisualFact label={labels.polymerName} value={copy.polymerName} />
          )}
          {labels.repeatUnit === undefined || copy === undefined ? null : (
            <VisualFact label={labels.repeatUnit} value={copy.repeatUnit} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
