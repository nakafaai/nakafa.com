import {
  ACCELERATION_CASES,
  ACCELERATION_LAB_SCENE,
  type AccelerationCaseId,
  DEFAULT_ACCELERATION_CASE_ID,
  getAccelerationMotionState,
  isAccelerationCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { SpaceFlightScene } from "@repo/design-system/components/contents/physics/kinematics/acceleration/scene";
import {
  formatAccelerationMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

interface AccelerationLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseCase: string;
    factLabels: {
      acceleration: ReactNode;
      finalVelocity: ReactNode;
      initialVelocity: ReactNode;
      timeStep: ReactNode;
    };
    scenarioNames: Record<AccelerationCaseId, ReactNode>;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

export function AccelerationLab({
  title,
  description,
  labels,
}: AccelerationLabProps) {
  const [caseId, setCaseId] = useState<AccelerationCaseId>(
    DEFAULT_ACCELERATION_CASE_ID
  );
  const motion = useMemo(() => getAccelerationMotionState(caseId), [caseId]);
  const facts = [
    {
      id: "initial-velocity",
      label: labels.factLabels.initialVelocity,
      math: `v_0=${formatTrimmedSpeedMath(motion.scenario.v0)}`,
    },
    {
      id: "acceleration",
      indicatorColor: motion.scenario.color,
      label: labels.factLabels.acceleration,
      math: `a=${formatAccelerationMath(motion.acceleration)}`,
    },
    {
      id: "final-velocity",
      label: labels.factLabels.finalVelocity,
      math: `v_t=${formatTrimmedSpeedMath(motion.scenario.v1)}`,
    },
    {
      id: "time-step",
      label: labels.factLabels.timeStep,
      math: `\\Delta t=${formatTrimmedSecondMath(1)}`,
    },
  ];

  function handleCaseChange(value: string) {
    if (!isAccelerationCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {Arr.map(ACCELERATION_CASES, (scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              {labels.scenarioNames[scenario.id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always">
          <Suspense>
            <CameraControls
              cameraPosition={ACCELERATION_LAB_SCENE.cameraPosition}
              cameraTarget={ACCELERATION_LAB_SCENE.cameraTarget}
              enablePan
              enableRotate
              enableZoom
              fov={ACCELERATION_LAB_SCENE.cameraFov}
              framing="content"
            />
            <SpaceFlightScene motion={motion} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(facts, (fact) => (
            <VisualFactIndicator
              indicatorColor={
                "indicatorColor" in fact ? fact.indicatorColor : undefined
              }
              key={fact.id}
              label={fact.label}
              value={<InlineMath math={fact.math} />}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
