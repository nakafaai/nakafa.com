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
import { getColor } from "@repo/design-system/lib/color";
import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useMemo, useState } from "react";

const FLASH_COLOR = getColor("ORANGE", 500);

/** Reuses the projectile lesson's scene and controls inside the flat bento. */
export function FeaturesProjectileScene() {
  const t = useTranslations("Features");
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [scenarioId, setScenarioId] = useState<ProjectileScenarioId>(
    DEFAULT_PROJECTILE_SCENARIO_ID
  );
  const motion = useMemo(
    () => getProjectileMotionState(scenarioId),
    [scenarioId]
  );
  const decimalSeparator = locale === "id" ? "comma" : "dot";
  const instantVelocity = getVelocityAtTime(motion, PROJECTILE_INSTANT_TIME);
  const facts = [
    {
      id: "horizontal-component",
      label: t("projectile-horizontal-component"),
      value: (
        <InlineMath
          math={`v_{0x}=${formatSpeedMath(
            motion.horizontalVelocity,
            decimalSeparator
          )}`}
        />
      ),
    },
    {
      id: "vertical-component",
      label: t("projectile-vertical-component"),
      value: (
        <InlineMath
          math={`v_{0y}=${formatSpeedMath(
            motion.verticalVelocity,
            decimalSeparator
          )}`}
        />
      ),
    },
    {
      id: "peak-time",
      label: t("projectile-peak-time"),
      value: (
        <InlineMath
          math={`t=${formatSecondMath(motion.peakTime, decimalSeparator)}`}
        />
      ),
    },
    {
      id: "flight-time",
      label: t("projectile-flight-time"),
      value: (
        <InlineMath
          math={`T=${formatSecondMath(motion.flightTime, decimalSeparator)}`}
        />
      ),
    },
    {
      id: "range",
      label: t("projectile-range"),
      value: (
        <InlineMath
          math={`R=${formatMeterMath(motion.range, decimalSeparator)}`}
        />
      ),
    },
    {
      id: "instantaneous-velocity",
      label: t("projectile-instantaneous-velocity"),
      value: (
        <InlineMath
          math={`\\vec{v}=${formatVelocityVectorMath(
            instantVelocity.horizontalVelocity,
            instantVelocity.verticalVelocity,
            decimalSeparator
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
    <div className="relative flex min-h-[42rem] flex-col overflow-hidden bg-background lg:col-span-7 lg:min-h-[44rem]">
      <div className="flex min-h-0 flex-1 flex-col gap-8 p-8 lg:p-10">
        <h3 className="max-w-2xl text-balance text-3xl tracking-tight sm:text-4xl">
          {t.rich("projectile-title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h3>

        <div className="mt-auto flex flex-col gap-4">
          <ToggleGroup
            aria-label={t("projectile-controls")}
            gridColumns="3"
            onValueChange={handleScenarioChange}
            type="single"
            value={scenarioId}
            variant="outline"
          >
            {PROJECTILE_SCENARIOS.map((scenario) => (
              <ToggleGroupItem key={scenario.id} value={scenario.id}>
                {t(`projectile-${scenario.id}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <section
            aria-label={t("projectile-view-label")}
            className={threeSceneFrameVariants()}
          >
            <ThreeCanvas frameloop={shouldReduceMotion ? "demand" : "always"}>
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
        </div>
      </div>

      <div className="border-t p-8 lg:p-10">
        <dl className="grid w-full grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {facts.map((fact) => (
            <div className="flex min-w-0 flex-col gap-1" key={fact.id}>
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="wrap-break-word text-foreground tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
