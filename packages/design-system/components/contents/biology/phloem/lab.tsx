import type { RingMode } from "@repo/design-system/components/contents/biology/phloem/model";
import { evaluatePhloemFlow } from "@repo/design-system/components/contents/biology/phloem/model";
import { PhloemTranslocationScene } from "@repo/design-system/components/contents/biology/phloem/scene";
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

export function PhloemTranslocationLab({
  description,
  labels,
  modes,
  sourceSucrose,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly barkState?: ReactNode;
    readonly mode: string;
    readonly modes: Readonly<
      Partial<
        Record<
          RingMode,
          { readonly name: ReactNode; readonly outcome: ReactNode }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "companionCell" | "sievePlate" | "sieveTube" | "sucrose" | "xylem",
        string
      >
    >;
    readonly pressureDiff?: ReactNode;
    readonly sourceSucrose: string;
    readonly view: string;
  };
  readonly modes: readonly [RingMode, ...RingMode[]];
  readonly sourceSucrose: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<RingMode>(modes[0]);
  const [sucrose, setSucrose] = useState(sourceSucrose.value);
  const quantity = useQuantity();

  const active = Arr.contains(modes, selected) ? selected : modes[0];
  const reading = evaluatePhloemFlow(active, sucrose);
  const copy = labels.modes[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(modes[0]);
          setSucrose(sourceSucrose.value);
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
          heading={labels.sourceSucrose}
          label={labels.sourceSucrose}
          max={sourceSucrose.max}
          min={sourceSucrose.min}
          onValueChange={setSucrose}
          readout={`${Math.round(sucrose)}`}
          step={Math.max(1, (sourceSucrose.max - sourceSucrose.min) / 100)}
          value={sucrose}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <PhloemTranslocationScene
              mode={active}
              parts={labels.parts}
              sourceSucrose={sucrose}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.mode} value={copy?.name ?? active} />
          {labels.barkState === undefined || copy === undefined ? null : (
            <VisualFact label={labels.barkState} value={copy.outcome} />
          )}
          {labels.pressureDiff === undefined ? null : (
            <VisualFactTabular
              label={labels.pressureDiff}
              value={
                <InlineMath
                  math={quantity(reading.pressureMpa, "\\text{ MPa}", 2)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
