"use client";

import {
  AVERAGE_VELOCITY_SPEED_CAMERA,
  AVERAGE_VELOCITY_SPEED_CASE_IDS,
  AVERAGE_VELOCITY_SPEED_COLORS,
  type AverageVelocitySpeedCaseId,
  type AverageVelocitySpeedLabProps,
  formatMeterMath,
  formatSecondsMath,
  formatSpeedMath,
  getAverageVelocitySpeedState,
  isAverageVelocitySpeedCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/data";
import { AverageMotionStage } from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { useMemo, useState } from "react";

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
      math: `s_{\\text{total}}=${formatMeterMath(
        motion.distance,
        decimalSeparator
      )}`,
      markerColor: AVERAGE_VELOCITY_SPEED_COLORS.distance,
    },
    {
      id: "displacement",
      label: labels.factLabels.displacement,
      math: `|\\Delta \\vec r|=${formatMeterMath(
        motion.displacement,
        decimalSeparator
      )}`,
      markerColor: AVERAGE_VELOCITY_SPEED_COLORS.displacement,
    },
    {
      id: "time",
      label: labels.factLabels.time,
      math: `\\Delta t=${formatSecondsMath(motion.duration, decimalSeparator)}`,
    },
    {
      id: "speed",
      label: labels.factLabels.speed,
      math: `\\frac{s_{\\text{total}}}{\\Delta t}=${formatSpeedMath(
        motion.speed,
        decimalSeparator
      )}`,
    },
    {
      id: "velocity",
      label: labels.factLabels.velocity,
      math: `\\frac{|\\Delta \\vec r|}{\\Delta t}=${formatSpeedMath(
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
    <Frame className="overflow-hidden content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>

      <FramePanel className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCase}
          gridColumns="3"
          onValueChange={handleCaseChange}
          type="single"
          value={caseId}
          variant="outline"
        >
          {AVERAGE_VELOCITY_SPEED_CASE_IDS.map((caseOption) => (
            <ToggleGroupItem key={caseOption} value={caseOption}>
              {labels.modeLabels[caseOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.viewLabel}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: AVERAGE_VELOCITY_SPEED_CAMERA.fov,
              position: AVERAGE_VELOCITY_SPEED_CAMERA.cameraPosition,
            }}
            frameloop="always"
          >
            <AverageMotionStage motion={motion} />
          </ThreeCanvas>
        </section>
      </FramePanel>

      <FrameFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {facts.map((fact) => (
            <div className="flex min-w-0 flex-col gap-1" key={fact.id}>
              <dt className="flex items-center gap-2 text-muted-foreground">
                {"markerColor" in fact ? (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: fact.markerColor }}
                  />
                ) : null}
                {fact.label}
              </dt>
              <dd className="wrap-break-word text-foreground tabular-nums">
                <InlineMath math={fact.math} />
              </dd>
            </div>
          ))}
        </dl>
      </FrameFooter>
    </Frame>
  );
}
