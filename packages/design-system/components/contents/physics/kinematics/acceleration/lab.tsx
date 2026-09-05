"use client";

import {
  ACCELERATION_CASES,
  ACCELERATION_LAB_SCENE,
  type AccelerationCaseId,
  type AccelerationLabProps,
  DEFAULT_ACCELERATION_CASE_ID,
  formatAccelerationMath,
  formatMeterPerSecondMath,
  formatSecondMath,
  getAccelerationMotionState,
  isAccelerationCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { SpaceFlightScene } from "@repo/design-system/components/contents/physics/kinematics/acceleration/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { getColor } from "@repo/design-system/lib/color";
import { type ReactNode, Suspense, useMemo, useState } from "react";

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
      value: (
        <InlineMath
          math={`v_0=${formatMeterPerSecondMath(motion.scenario.v0)}`}
        />
      ),
    },
    {
      id: "acceleration",
      indicatorColor: motion.scenario.color,
      label: labels.factLabels.acceleration,
      value: (
        <InlineMath math={`a=${formatAccelerationMath(motion.acceleration)}`} />
      ),
    },
    {
      id: "final-velocity",
      label: labels.factLabels.finalVelocity,
      value: (
        <InlineMath
          math={`v_t=${formatMeterPerSecondMath(motion.scenario.v1)}`}
        />
      ),
    },
    {
      id: "time-step",
      label: labels.factLabels.timeStep,
      value: <InlineMath math={`\\Delta t=${formatSecondMath(1)}`} />,
    },
  ];

  function handleCaseChange(value: string) {
    if (!isAccelerationCaseId(value)) {
      return;
    }

    setCaseId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {ACCELERATION_CASES.map((scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              {labels.scenarioNames[scenario.id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
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
              />
              <SpaceFlightScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <LabFact
              indicatorColor={
                "indicatorColor" in fact ? fact.indicatorColor : undefined
              }
              key={fact.id}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function LabFact({
  indicatorColor,
  label,
  value,
}: {
  indicatorColor?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {indicatorColor ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
