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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

interface ProjectileAnalysisLabProps {
  decimalSeparator?: DecimalSeparator;
  description: NonNullable<ReactNode>;
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
  title: NonNullable<ReactNode>;
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

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always">
          <Suspense>
            <CameraControls
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
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(facts, (fact) => (
            <VisualFactTabular
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
