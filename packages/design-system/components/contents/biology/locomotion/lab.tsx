import type {
  LocomotionAnimal,
  LocomotionMuscle,
  LocomotionPart,
} from "@repo/design-system/components/contents/biology/locomotion/model";
import { activeMuscleAt } from "@repo/design-system/components/contents/biology/locomotion/model";
import { LocomotionScene } from "@repo/design-system/components/contents/biology/locomotion/scene";
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
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function AnimalLocomotionLab({
  animals,
  description,
  labels,
  title,
}: {
  readonly animals: readonly [LocomotionAnimal, ...LocomotionAnimal[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly against: ReactNode;
    readonly animal: string;
    readonly animals: Readonly<
      Partial<
        Record<
          LocomotionAnimal,
          {
            readonly against: ReactNode;
            readonly name: ReactNode;
            readonly skeleton: ReactNode;
          }
        >
      >
    >;
    readonly contracting: ReactNode;
    readonly muscles: Readonly<Record<LocomotionMuscle, string>>;
    readonly parts: Readonly<Record<LocomotionPart, string>>;
    readonly skeleton: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [animal, setAnimal] = useState<LocomotionAnimal>(animals[0]);
  const [activeMuscle, setActiveMuscle] = useState<LocomotionMuscle>(() =>
    activeMuscleAt(animals[0], 0.2)
  );
  const entry = labels.animals[animal];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setAnimal(animals[0]);
          setActiveMuscle(activeMuscleAt(animals[0], 0.2));
        }}
      />

      {animals.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.animal}
            gridColumns={toggleColumns(animals.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(animals, (item) => item === next),
                (picked) => {
                  setAnimal(picked);
                  setActiveMuscle(activeMuscleAt(picked, 0.2));
                }
              );
            }}
            type="single"
            value={animal}
            variant="outline"
          >
            {Arr.map(animals, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.animals[item]?.name ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          reach={2.4}
          setting={animal === "bird" ? "sky" : "field"}
        >
          <Suspense fallback={null}>
            <LocomotionScene
              activeMuscle={activeMuscle}
              animal={animal}
              onMuscleChange={setActiveMuscle}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.skeleton}
            value={entry?.skeleton ?? animal}
          />
          <VisualFact label={labels.against} value={entry?.against ?? animal} />
          <VisualFactIndicator
            indicatorColor={SKELETON_COLORS.muscleContract}
            label={labels.contracting}
            value={labels.muscles[activeMuscle]}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
