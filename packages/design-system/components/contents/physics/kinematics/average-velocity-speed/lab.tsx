import {
  AVERAGE_VELOCITY_SPEED_CASE_IDS,
  AVERAGE_VELOCITY_SPEED_COLORS,
  type AverageVelocitySpeedCaseId,
  getAverageVelocitySpeedState,
  isAverageVelocitySpeedCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/data";
import {
  AverageMotionScene,
  AverageMotionStage,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/scene";
import {
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { type ReactNode, useMemo, useState } from "react";

interface AverageVelocitySpeedLabProps {
  decimalSeparator?: DecimalSeparator;
  description: NonNullable<ReactNode>;
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
  title: NonNullable<ReactNode>;
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

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always">
          <AverageMotionStage>
            <AverageMotionScene motion={motion} />
          </AverageMotionStage>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
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
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
