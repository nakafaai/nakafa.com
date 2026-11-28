import type {
  JointKind,
  JointPart,
} from "@repo/design-system/components/contents/biology/joint/model";
import { JointScene } from "@repo/design-system/components/contents/biology/joint/scene";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function JointMovementLab({
  description,
  joints,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly joints: readonly [JointKind, ...JointKind[]];
  readonly labels: {
    readonly example: ReactNode;
    readonly joint: string;
    readonly joints: Readonly<
      Partial<
        Record<
          JointKind,
          {
            readonly example: ReactNode;
            readonly movement: ReactNode;
            readonly name: ReactNode;
          }
        >
      >
    >;
    readonly move: string;
    readonly movement: ReactNode;
    readonly parts: Readonly<Record<JointPart, string>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [joint, setJoint] = useState<JointKind>(joints[0]);
  const [motion, setMotion] = useState(0.45);
  const quantity = useQuantity();
  const entry = labels.joints[joint];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setJoint(joints[0]);
          setMotion(0.45);
        }}
      />

      <VisualCardToolbar>
        {joints.length > 1 ? (
          <ToggleGroup
            aria-label={labels.joint}
            gridColumns={toggleColumns(joints.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(joints, (item) => item === next),
                (picked) => {
                  setJoint(picked);
                  setMotion(0.45);
                }
              );
            }}
            type="single"
            value={joint}
            variant="outline"
          >
            {Arr.map(joints, (item) => (
              <ToggleGroupItem key={item} value={item}>
                {labels.joints[item]?.name ?? item}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.move}
          label={labels.move}
          max={100}
          min={0}
          onValueChange={(next) => setMotion(next / 100)}
          pauseOnChange
          readout={<InlineMath math={quantity(motion * 100, "\\%", 0)} />}
          step={1}
          value={Math.round(motion * 100)}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={4} setting="studio">
          <Suspense fallback={null}>
            <JointScene
              joint={joint}
              motion={motion}
              onMotionChange={setMotion}
              parts={labels.parts}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.example} value={entry?.example ?? joint} />
          <VisualFact
            label={labels.movement}
            value={entry?.movement ?? joint}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
