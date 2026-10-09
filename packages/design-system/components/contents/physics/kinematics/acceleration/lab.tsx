"use client";

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
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

interface AccelerationLabProps {
  description: ReactNode;
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
  title: ReactNode;
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

      <VisualCardBody className="flex flex-col gap-4">
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

        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <ambientLight intensity={0.42} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("ZINC", 950)}
                intensity={0.55}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[-2.6, 4.6, 3.8]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <CameraControls
                autoRotate={false}
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
          </ThreeCanvas>
        </VisualCardScene>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
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
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
