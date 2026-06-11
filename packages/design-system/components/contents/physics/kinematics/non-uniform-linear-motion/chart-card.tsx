"use client";

import {
  DEFAULT_GLBB_SCENARIO_ID,
  GLBB_SCENARIOS,
  type GlbbLabels,
  type GlbbScenarioId,
  getGlbbScenarioById,
  isGlbbScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import { VelocityTimeGraph } from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/graph";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@repo/design-system/components/ui/frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import type { ReactNode } from "react";
import { useState } from "react";

interface NonUniformLinearMotionGraphCardProps {
  description: ReactNode;
  labels: GlbbLabels;
  title: ReactNode;
}

export function NonUniformLinearMotionGraphCard({
  title,
  description,
  labels,
}: NonUniformLinearMotionGraphCardProps) {
  const [scenarioId, setScenarioId] = useState<GlbbScenarioId>(
    DEFAULT_GLBB_SCENARIO_ID
  );
  const scenario = getGlbbScenarioById(scenarioId);

  function handleScenarioChange(nextScenarioId: string) {
    if (nextScenarioId && isGlbbScenarioId(nextScenarioId)) {
      setScenarioId(nextScenarioId);
    }
  }

  return (
    <Frame className="content-auto-card">
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        <FrameDescription>{description}</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4">
        <GlbbScenarioToggle
          labels={labels}
          onScenarioChange={handleScenarioChange}
          scenarioId={scenarioId}
        />
        <VelocityTimeGraph labels={labels} scenario={scenario} />
      </FramePanel>
    </Frame>
  );
}

function GlbbScenarioToggle({
  labels,
  onScenarioChange,
  scenarioId,
}: {
  labels: GlbbLabels;
  onScenarioChange: (nextScenarioId: string) => void;
  scenarioId: GlbbScenarioId;
}) {
  return (
    <ToggleGroup
      aria-label={labels.chooseScenario}
      gridColumns="3"
      onValueChange={onScenarioChange}
      type="single"
      value={scenarioId}
      variant="outline"
    >
      {GLBB_SCENARIOS.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id}>
          {labels.scenarioNames[item.id]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
