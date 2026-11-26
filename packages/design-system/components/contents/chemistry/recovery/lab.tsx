import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { CatalysisMode } from "@repo/design-system/components/contents/chemistry/recovery/model";
import { GreenCatalystScene } from "@repo/design-system/components/contents/chemistry/recovery/scene";
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

export function GreenCatalystCycleLab({
  cycles,
  description,
  labels,
  modes,
  title,
}: {
  readonly cycles: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly cycles: string;
    readonly eFactor?: ReactNode;
    readonly mode: string;
    readonly modes: Readonly<
      Partial<
        Record<
          CatalysisMode,
          {
            readonly eFactor: ReactNode;
            readonly name: string;
            readonly recoveryNote: ReactNode;
          }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "catalystBed"
        | "productOut"
        | "reactantStream"
        | "recoveryLoop"
        | "wasteBin",
        string
      >
    >;
    readonly recoveryNote?: ReactNode;
    readonly view: string;
  };
  readonly modes: readonly [CatalysisMode, ...CatalysisMode[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<CatalysisMode>(modes[0]);
  const [cycleVal, setCycleVal] = useState(cycles.value);

  const active = Arr.contains(modes, selected) ? selected : modes[0];
  const copy = labels.modes[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(modes[0]);
          setCycleVal(cycles.value);
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
                {labels.modes[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.cycles}
          label={labels.cycles}
          max={cycles.max}
          min={cycles.min}
          onValueChange={setCycleVal}
          readout={`${Math.round(cycleVal)}`}
          step={1}
          value={cycleVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.95} setting="lab">
          <Suspense fallback={null}>
            <GreenCatalystScene
              cycles={cycleVal}
              cyclesMax={cycles.max}
              cyclesMin={cycles.min}
              mode={active}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              active === "stoichiometric"
                ? PROCESS_COLORS.wasteSlate
                : PROCESS_COLORS.greenProduct
            }
            label={labels.mode}
            value={copy?.name ?? active}
          />
          {labels.eFactor === undefined || copy === undefined ? null : (
            <VisualFact label={labels.eFactor} value={copy.eFactor} />
          )}
          {labels.recoveryNote === undefined || copy === undefined ? null : (
            <VisualFact label={labels.recoveryNote} value={copy.recoveryNote} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
