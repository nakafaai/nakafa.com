import type {
  LegMovement,
  LimbKind,
  LimbPart,
  MuscleId,
} from "@repo/design-system/components/contents/biology/limb/model";
import {
  ARM_ANGLE_DEFAULT,
  ARM_ANGLE_MAX,
  ARM_ANGLE_MIN,
  armPairAt,
  legPairFor,
} from "@repo/design-system/components/contents/biology/limb/model";
import { MusclePairScene } from "@repo/design-system/components/contents/biology/limb/scene";
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
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const LEG_MOVEMENTS = ["heel", "toes", "bend", "straighten"] as const;

export function MusclePairLab({
  description,
  labels,
  limbs,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly angle: string;
    readonly contracting: ReactNode;
    readonly limb: string;
    readonly limbs: Readonly<Partial<Record<LimbKind, string>>>;
    readonly movement: string;
    readonly movements: Readonly<Record<LegMovement, string>>;
    readonly muscles: Readonly<Record<MuscleId, string>>;
    readonly parts: Readonly<Record<LimbPart, string>>;
    readonly relaxing: ReactNode;
    readonly view: string;
  };
  readonly limbs: readonly [LimbKind, ...LimbKind[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [limb, setLimb] = useState<LimbKind>(limbs[0]);
  const [angleDeg, setAngleDeg] = useState(ARM_ANGLE_DEFAULT);
  const [movement, setMovement] = useState<LegMovement>("heel");
  const quantity = useQuantity();

  const pair = limb === "arm" ? armPairAt(angleDeg) : legPairFor(movement);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setLimb(limbs[0]);
          setAngleDeg(ARM_ANGLE_DEFAULT);
          setMovement("heel");
        }}
      />

      <VisualCardToolbar>
        {limbs.length > 1 ? (
          <ToggleGroup
            aria-label={labels.limb}
            gridColumns={toggleColumns(limbs.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(limbs, (item) => item === next),
                setLimb
              );
            }}
            type="single"
            value={limb}
            variant="outline"
          >
            {Arr.map(limbs, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.limbs[item] ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {limb === "arm" ? (
          <VisualSlider
            heading={labels.angle}
            label={labels.angle}
            max={ARM_ANGLE_MAX}
            min={ARM_ANGLE_MIN}
            onValueChange={setAngleDeg}
            readout={<InlineMath math={quantity(angleDeg, "^\\circ", 0)} />}
            step={1}
            value={angleDeg}
          />
        ) : (
          <ToggleGroup
            aria-label={labels.movement}
            gridColumns="2"
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(LEG_MOVEMENTS, (item) => item === next),
                setMovement
              );
            }}
            type="single"
            value={movement}
            variant="outline"
          >
            {Arr.map(LEG_MOVEMENTS, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.movements[item]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <MusclePairScene
              angleDeg={angleDeg}
              limb={limb}
              movement={movement}
              muscles={labels.muscles}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={SKELETON_COLORS.muscleContract}
            label={labels.contracting}
            value={labels.muscles[pair.contracting]}
          />
          <VisualFactIndicator
            indicatorColor={SKELETON_COLORS.muscleRelax}
            label={labels.relaxing}
            value={labels.muscles[pair.relaxing]}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
