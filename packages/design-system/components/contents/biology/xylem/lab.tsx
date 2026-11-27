import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { LiftForce } from "@repo/design-system/components/contents/biology/xylem/model";
import { evaluateXylemLift } from "@repo/design-system/components/contents/biology/xylem/model";
import { XylemCohesionScene } from "@repo/design-system/components/contents/biology/xylem/scene";
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

export function XylemCohesionLab({
  description,
  forces,
  height,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly forces: readonly [LiftForce, ...LiftForce[]];
  readonly height: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly force: string;
    readonly forces: Readonly<
      Partial<
        Record<
          LiftForce,
          { readonly mechanism: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly height: string;
    readonly mechanism?: ReactNode;
    readonly parts: Readonly<
      Record<
        "cohesionBond" | "ligninWall" | "rootCell" | "stoma" | "waterColumn",
        string
      >
    >;
    readonly pressureNeeded?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<LiftForce>(forces[0]);
  const [treeHeight, setTreeHeight] = useState(height.value);
  const quantity = useQuantity();

  const active = Arr.contains(forces, selected) ? selected : forces[0];
  const reading = evaluateXylemLift(active, treeHeight);
  const copy = labels.forces[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(forces[0]);
          setTreeHeight(height.value);
        }}
      />

      <VisualCardToolbar>
        {forces.length > 1 ? (
          <ToggleGroup
            aria-label={labels.force}
            gridColumns={toggleColumns(forces.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(forces, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(forces, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.forces[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.height}
          label={labels.height}
          max={height.max}
          min={height.min}
          onValueChange={setTreeHeight}
          readout={<InlineMath math={quantity(treeHeight, "\\text{ m}", 0)} />}
          step={Math.max(1, (height.max - height.min) / 50)}
          value={treeHeight}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <XylemCohesionScene
              force={active}
              heightMeters={treeHeight}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.force} value={copy?.name ?? active} />
          {labels.mechanism === undefined || copy === undefined ? null : (
            <VisualFact label={labels.mechanism} value={copy.mechanism} />
          )}
          {labels.pressureNeeded === undefined ? null : (
            <VisualFactTabular
              label={labels.pressureNeeded}
              value={
                <InlineMath
                  math={quantity(reading.pressureKpa, "\\text{ kPa}", 1)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
