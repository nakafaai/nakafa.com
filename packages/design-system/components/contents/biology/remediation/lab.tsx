import type { RemediationPlant } from "@repo/design-system/components/contents/biology/remediation/model";
import { evaluatePhytoremediation } from "@repo/design-system/components/contents/biology/remediation/model";
import { PhytoremediationScene } from "@repo/design-system/components/contents/biology/remediation/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function PhytoremediationLab({
  description,
  harvests,
  labels,
  plants,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly harvests: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly harvests: string;
    readonly medium?: ReactNode;
    readonly parts: Readonly<
      Record<
        "metalIon" | "rootZone" | "shoot" | "soilBed" | "waterChannel",
        string
      >
    >;
    readonly plant: string;
    readonly plants: Readonly<
      Partial<
        Record<
          RemediationPlant,
          { readonly medium: ReactNode; readonly name: string }
        >
      >
    >;
    readonly remaining?: ReactNode;
    readonly view: string;
  };
  readonly plants: readonly [RemediationPlant, ...RemediationPlant[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<RemediationPlant>(plants[0]);
  const [cycles, setCycles] = useState(harvests.value);

  const active = Arr.contains(plants, selected) ? selected : plants[0];
  const reading = evaluatePhytoremediation(active, cycles);
  const copy = labels.plants[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(plants[0]);
          setCycles(harvests.value);
        }}
      />

      <VisualCardToolbar>
        {plants.length > 1 ? (
          <ToggleGroup
            aria-label={labels.plant}
            gridColumns={toggleColumns(plants.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(plants, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(plants, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.plants[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.harvests}
          label={labels.harvests}
          max={harvests.max}
          min={harvests.min}
          onValueChange={setCycles}
          readout={`${Math.round(cycles)}`}
          step={1}
          value={cycles}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <PhytoremediationScene
              harvests={cycles}
              parts={labels.parts}
              plant={active}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.plant} value={copy?.name ?? active} />
          {labels.medium === undefined || copy === undefined ? null : (
            <VisualFact label={labels.medium} value={copy.medium} />
          )}
          {labels.remaining === undefined ? null : (
            <VisualFactTabular
              label={labels.remaining}
              value={`${reading.remainingPercent}%`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
