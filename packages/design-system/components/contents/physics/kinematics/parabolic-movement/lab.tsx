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
  type ParabolicMovementLabProps,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { ProjectileBallScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import { type ReactNode, Suspense, useMemo, useState } from "react";

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
      value: (
        <InlineMath
          math={`v_0=${formatSpeedMath(
            motion.scenario.initialSpeed,
            decimalSeparator
          )}`}
        />
      ),
    },
    {
      id: "flight-time",
      label: labels.factLabels.flightTime,
      value: (
        <InlineMath
          math={`T=${formatSecondMath(motion.flightTime, decimalSeparator)}`}
        />
      ),
    },
    {
      id: "range",
      label: labels.factLabels.range,
      value: (
        <InlineMath
          math={`R=${formatMeterMath(motion.range, decimalSeparator)}`}
        />
      ),
    },
    {
      id: "peak-height",
      label: labels.factLabels.peakHeight,
      value: (
        <InlineMath
          math={`h_{\\max}=${formatMeterMath(
            motion.peakHeight,
            decimalSeparator
          )}`}
        />
      ),
    },
  ];

  function handleLaunchChange(value: string) {
    if (!isParabolicLaunchId(value)) {
      return;
    }

    setLaunchId(value);
  }

  return (
    <Frame className="overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseLaunch}
          gridColumns="3"
          onValueChange={handleLaunchChange}
          type="single"
          value={launchId}
          variant="outline"
        >
          {PARABOLIC_LAUNCHES.map((launch) => (
            <ToggleGroupItem key={launch.id} value={launch.id}>
              <InlineMath math={formatAngleMath(launch.angleDegrees)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
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
                maxDistance={PARABOLIC_SCENE.maxDistance}
                minDistance={PARABOLIC_SCENE.minDistance}
              />
              <ProjectileBallScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </FramePanel>

      <FrameFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <LabFact key={fact.id} label={fact.label} value={fact.value} />
          ))}
        </dl>
      </FrameFooter>
    </Frame>
  );
}

function LabFact({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
