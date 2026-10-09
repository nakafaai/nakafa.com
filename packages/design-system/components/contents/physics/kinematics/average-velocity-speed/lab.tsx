"use client";

import {
  AVERAGE_VELOCITY_SPEED_CASE_IDS,
  AVERAGE_VELOCITY_SPEED_COLORS,
  type AverageVelocitySpeedCaseId,
  getAverageVelocitySpeedState,
  isAverageVelocitySpeedCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/data";
import { AverageMotionStage } from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/scene";
import {
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { Array as Arr } from "effect";
import { type ReactNode, useMemo, useState } from "react";

interface AverageVelocitySpeedLabProps {
  decimalSeparator?: DecimalSeparator;
  description: ReactNode;
  labels: {
    chooseCase: string;
    factLabels: {
      displacement: ReactNode;
      distance: ReactNode;
      speed: ReactNode;
      time: ReactNode;
      velocity: ReactNode;
    };
    modeLabels: Record<AverageVelocitySpeedCaseId, ReactNode>;
    viewLabel: string;
  };
  title: ReactNode;
}

export function AverageVelocitySpeedLab({
  decimalSeparator,
  title,
  description,
  labels,
}: AverageVelocitySpeedLabProps) {
  const [caseId, setCaseId] = useState<AverageVelocitySpeedCaseId>("bank");
  const motion = useMemo(() => getAverageVelocitySpeedState(caseId), [caseId]);
  const facts = [
    {
      id: "distance",
      label: labels.factLabels.distance,
      math: `s_{\\text{total}}=${formatTrimmedMeterMath(
        motion.distance,
        decimalSeparator
      )}`,
      markerColor: AVERAGE_VELOCITY_SPEED_COLORS.distance,
    },
    {
      id: "displacement",
      label: labels.factLabels.displacement,
      math: `|\\Delta \\vec r|=${formatTrimmedMeterMath(
        motion.displacement,
        decimalSeparator
      )}`,
      markerColor: AVERAGE_VELOCITY_SPEED_COLORS.displacement,
    },
    {
      id: "time",
      label: labels.factLabels.time,
      math: `\\Delta t=${formatTrimmedSecondMath(motion.duration, decimalSeparator)}`,
    },
    {
      id: "speed",
      label: labels.factLabels.speed,
      math: `\\frac{s_{\\text{total}}}{\\Delta t}=${formatTrimmedSpeedMath(
        motion.speed,
        decimalSeparator
      )}`,
    },
    {
      id: "velocity",
      label: labels.factLabels.velocity,
      math: `\\frac{|\\Delta \\vec r|}{\\Delta t}=${formatTrimmedSpeedMath(
        motion.velocityMagnitude,
        decimalSeparator
      )}`,
    },
  ];

  function handleCaseChange(value: string) {
    if (!isAverageVelocitySpeedCaseId(value)) {
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
          {Arr.map(AVERAGE_VELOCITY_SPEED_CASE_IDS, (caseOption) => (
            <ToggleGroupItem key={caseOption} value={caseOption}>
              {labels.modeLabels[caseOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <VisualCardScene
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
            <AverageMotionStage motion={motion} />
          </ThreeCanvas>
        </VisualCardScene>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {Arr.map(facts, (fact) => (
            <VisualFactIndicator
              indicatorColor={
                "markerColor" in fact ? fact.markerColor : undefined
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
