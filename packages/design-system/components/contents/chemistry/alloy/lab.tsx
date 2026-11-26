import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { AlloyMetal } from "@repo/design-system/components/contents/chemistry/alloy/model";
import { AlloySlipPlaneScene } from "@repo/design-system/components/contents/chemistry/alloy/scene";
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
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function AlloySlipPlaneLab({
  description,
  labels,
  metals,
  shearForce,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly hardnessNote?: ReactNode;
    readonly metal: string;
    readonly metals: Readonly<
      Partial<
        Record<
          AlloyMetal,
          {
            readonly hardnessNote: ReactNode;
            readonly name: string;
            readonly structureNote: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<"foreignAtom" | "hostAtom" | "shearArrow" | "slipPlane", string>
    >;
    readonly shearForce: string;
    readonly structureNote?: ReactNode;
    readonly view: string;
  };
  readonly metals: readonly [AlloyMetal, ...AlloyMetal[]];
  readonly shearForce: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<AlloyMetal>(metals[0]);
  const [force, setForce] = useState(shearForce.value);

  const active = Arr.contains(metals, selected) ? selected : metals[0];
  const copy = labels.metals[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(metals[0]);
          setForce(shearForce.value);
        }}
      />

      <VisualCardToolbar>
        {metals.length > 1 ? (
          <ToggleGroup
            aria-label={labels.metal}
            gridColumns={toggleColumns(metals.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(metals, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(metals, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.metals[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.shearForce}
          label={labels.shearForce}
          max={shearForce.max}
          min={shearForce.min}
          onValueChange={setForce}
          readout={`${Math.round(force)}`}
          step={1}
          value={force}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <AlloySlipPlaneScene
              metal={active}
              parts={labels.parts}
              shearForce={force}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "pureIron"
                ? PROCESS_COLORS.anodeZinc
                : PROCESS_COLORS.electronGold
            }
            label={labels.metal}
            value={copy?.name ?? active}
          />
          {labels.hardnessNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.hardnessNote} value={copy.hardnessNote} />
          )}
          {labels.structureNote === undefined || copy === undefined ? null : (
            <VisualFact
              label={labels.structureNote}
              value={copy.structureNote}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
