"use client";

import {
  DEFAULT_PARABOLIC_LAUNCH_ID,
  formatAngleMath,
  formatMeterMath,
  formatSecondMath,
  formatSpeedMath,
  getParabolicMotionState,
  isParabolicLaunchId,
  PARABOLIC_LAUNCHES,
  PARABOLIC_SCENE,
  type ParabolicLaunchId,
  type ParabolicMovementDecimalSeparator,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { ProjectileBallScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/scene";
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

interface ParabolicMovementLabProps {
  decimalSeparator?: ParabolicMovementDecimalSeparator;
  description: ReactNode;
  labels: {
    chooseLaunch: string;
    factLabels: {
      flightTime: ReactNode;
      initialSpeed: ReactNode;
      peakHeight: ReactNode;
      range: ReactNode;
    };
    viewLabel: string;
  };
  title: ReactNode;
}

export function ParabolicMovementLab({
  decimalSeparator,
  title,
  description,
  labels,
}: ParabolicMovementLabProps) {
  const [launchId, setLaunchId] = useState<ParabolicLaunchId>(
    DEFAULT_PARABOLIC_LAUNCH_ID
  );
  const motion = useMemo(() => getParabolicMotionState(launchId), [launchId]);
  const facts = [
    {
      id: "initial-speed",
      label: labels.factLabels.initialSpeed,
      math: `v_0=${formatSpeedMath(
        motion.scenario.initialSpeed,
        decimalSeparator
      )}`,
    },
    {
      id: "flight-time",
      label: labels.factLabels.flightTime,
      math: `T=${formatSecondMath(motion.flightTime, decimalSeparator)}`,
    },
    {
      id: "range",
      label: labels.factLabels.range,
      math: `R=${formatMeterMath(motion.range, decimalSeparator)}`,
    },
    {
      id: "peak-height",
      label: labels.factLabels.peakHeight,
      math: `h_{\\max}=${formatMeterMath(motion.peakHeight, decimalSeparator)}`,
    },
  ];

  function handleLaunchChange(value: string) {
    if (!isParabolicLaunchId(value)) {
      return;
    }

    setLaunchId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseLaunch}
          gridColumns="3"
          onValueChange={handleLaunchChange}
          type="single"
          value={launchId}
          variant="outline"
        >
          {Arr.map(PARABOLIC_LAUNCHES, (launch) => (
            <ToggleGroupItem key={launch.id} value={launch.id}>
              <InlineMath math={formatAngleMath(launch.angleDegrees)} />
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
              <ambientLight intensity={0.72} />
              <hemisphereLight
                color={getColor("SLATE", 50)}
                groundColor={getColor("SLATE", 400)}
                intensity={0.68}
              />
              <directionalLight
                castShadow
                intensity={1.35}
                position={[4.2, 5.5, 4.8]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <directionalLight intensity={0.28} position={[-4, 3.2, -3.5]} />
              <CameraControls
                autoRotate={false}
                cameraPosition={PARABOLIC_SCENE.cameraPosition}
                cameraTarget={PARABOLIC_SCENE.cameraTarget}
                enablePan
                enableRotate
                enableZoom
                fov={PARABOLIC_SCENE.cameraFov}
              />
              <ProjectileBallScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </VisualCardScene>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
