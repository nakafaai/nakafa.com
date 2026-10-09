"use client";

import {
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import {
  DEFAULT_PROJECTILE_SCENARIO_ID,
  formatVelocityVectorMath,
  getProjectileMotionState,
  getVelocityAtTime,
  isProjectileScenarioId,
  PROJECTILE_INSTANT_TIME,
  PROJECTILE_SCENARIOS,
  PROJECTILE_SCENE,
  type ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { PirateProjectileScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/scene";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

const FLASH_COLOR = getColor("ORANGE", 500);

interface ProjectileAnalysisLabProps {
  decimalSeparator?: DecimalSeparator;
  description: ReactNode;
  labels: {
    chooseScenario: string;
    factLabels: {
      flightTime: ReactNode;
      horizontalComponent: ReactNode;
      instantaneousVelocity: ReactNode;
      peakTime: ReactNode;
      range: ReactNode;
      verticalComponent: ReactNode;
    };
    scenarioNames: Record<ProjectileScenarioId, ReactNode>;
    viewLabel: string;
  };
  title: ReactNode;
}

export function ParabolicMovementAnalysisLab({
  decimalSeparator,
  title,
  description,
  labels,
}: ProjectileAnalysisLabProps) {
  const [scenarioId, setScenarioId] = useState<ProjectileScenarioId>(
    DEFAULT_PROJECTILE_SCENARIO_ID
  );
  const motion = useMemo(
    () => getProjectileMotionState(scenarioId),
    [scenarioId]
  );
  const instantVelocity = getVelocityAtTime(motion, PROJECTILE_INSTANT_TIME);
  const facts = [
    {
      id: "horizontal-component",
      label: labels.factLabels.horizontalComponent,
      math: `v_{0x}=${formatTrimmedSpeedMath(
        motion.horizontalVelocity,
        decimalSeparator
      )}`,
    },
    {
      id: "vertical-component",
      label: labels.factLabels.verticalComponent,
      math: `v_{0y}=${formatTrimmedSpeedMath(
        motion.verticalVelocity,
        decimalSeparator
      )}`,
    },
    {
      id: "peak-time",
      label: labels.factLabels.peakTime,
      math: `t=${formatTrimmedSecondMath(motion.peakTime, decimalSeparator)}`,
    },
    {
      id: "flight-time",
      label: labels.factLabels.flightTime,
      math: `T=${formatTrimmedSecondMath(motion.flightTime, decimalSeparator)}`,
    },
    {
      id: "range",
      label: labels.factLabels.range,
      math: `R=${formatTrimmedMeterMath(motion.range, decimalSeparator)}`,
    },
    {
      id: "instantaneous-velocity",
      label: labels.factLabels.instantaneousVelocity,
      math: `\\vec{v}=${formatVelocityVectorMath(
        instantVelocity.horizontalVelocity,
        instantVelocity.verticalVelocity,
        decimalSeparator
      )}`,
    },
  ];

  function handleScenarioChange(value: string) {
    if (!isProjectileScenarioId(value)) {
      return;
    }

    setScenarioId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseScenario}
          gridColumns="3"
          onValueChange={handleScenarioChange}
          type="single"
          value={scenarioId}
          variant="outline"
        >
          {Arr.map(PROJECTILE_SCENARIOS, (scenario) => (
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
              <ambientLight intensity={0.62} />
              <hemisphereLight
                color={getColor("SKY", 400)}
                groundColor={getColor("TEAL", 700)}
                intensity={0.68}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[-3.4, 5.8, 4.7]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <pointLight
                color={FLASH_COLOR}
                intensity={0.45}
                position={PROJECTILE_SCENE.launchOffset}
              />
              <CameraControls
                autoRotate={false}
                cameraPosition={PROJECTILE_SCENE.cameraPosition}
                cameraTarget={PROJECTILE_SCENE.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                fov={PROJECTILE_SCENE.cameraFov}
                framing="content"
                maxPolarAngle={PROJECTILE_SCENE.maxPolarAngle}
              />
              <PirateProjectileScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </VisualCardScene>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
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
