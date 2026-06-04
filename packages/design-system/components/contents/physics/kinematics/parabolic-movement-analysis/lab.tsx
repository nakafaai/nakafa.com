"use client";

import {
  DEFAULT_PROJECTILE_SCENARIO_ID,
  formatMeterMath,
  formatSecondMath,
  formatSpeedMath,
  formatVelocityVectorMath,
  getProjectileMotionState,
  getVelocityAtTime,
  isProjectileScenarioId,
  PROJECTILE_ANALYSIS_COPY,
  PROJECTILE_INSTANT_TIME,
  PROJECTILE_SCENARIOS,
  PROJECTILE_SCENE,
  type ProjectileAnalysisLocale,
  type ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { PirateProjectileScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/scene";
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

const FLASH_COLOR = getColor("ORANGE", 500);

export function ParabolicMovementAnalysisLab({
  locale,
}: {
  locale: ProjectileAnalysisLocale;
}) {
  const labels = PROJECTILE_ANALYSIS_COPY[locale];
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
      label: labels.factLabels.horizontalComponent,
      value: (
        <InlineMath
          math={`v_{0x}=${formatSpeedMath(motion.horizontalVelocity, locale)}`}
        />
      ),
    },
    {
      label: labels.factLabels.verticalComponent,
      value: (
        <InlineMath
          math={`v_{0y}=${formatSpeedMath(motion.verticalVelocity, locale)}`}
        />
      ),
    },
    {
      label: labels.factLabels.peakTime,
      value: (
        <InlineMath math={`t=${formatSecondMath(motion.peakTime, locale)}`} />
      ),
    },
    {
      label: labels.factLabels.flightTime,
      value: (
        <InlineMath math={`T=${formatSecondMath(motion.flightTime, locale)}`} />
      ),
    },
    {
      label: labels.factLabels.range,
      value: <InlineMath math={`R=${formatMeterMath(motion.range, locale)}`} />,
    },
    {
      label: labels.factLabels.instantaneousVelocity,
      value: (
        <InlineMath
          math={`\\vec{v}=${formatVelocityVectorMath(
            instantVelocity.horizontalVelocity,
            instantVelocity.verticalVelocity,
            locale
          )}`}
        />
      ),
    },
  ];

  function handleScenarioChange(value: string) {
    if (!isProjectileScenarioId(value)) {
      return;
    }

    setScenarioId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseScenario}
          className="grid w-full grid-cols-3"
          layout="grid"
          onValueChange={handleScenarioChange}
          type="single"
          value={scenarioId}
          variant="outline"
        >
          {PROJECTILE_SCENARIOS.map((scenario) => (
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
                maxDistance={PROJECTILE_SCENE.maxDistance}
                minDistance={PROJECTILE_SCENE.minDistance}
              />
              <PirateProjectileScene motion={motion} />
            </Suspense>
          </ThreeCanvas>
        </section>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <LabFact key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </dl>
      </CardFooter>
    </Card>
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
