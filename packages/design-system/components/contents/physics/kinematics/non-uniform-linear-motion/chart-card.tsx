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
import { Array as Arr } from "effect";
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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="flex flex-col gap-4">
        <GlbbScenarioToggle
          labels={labels}
          onScenarioChange={handleScenarioChange}
          scenarioId={scenarioId}
        />
        <VisualCardScene>
          <VelocityTimeGraph labels={labels} scenario={scenario} />
        </VisualCardScene>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
      {Arr.map(GLBB_SCENARIOS, (item) => (
        <ToggleGroupItem key={item.id} value={item.id}>
          {labels.scenarioNames[item.id]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
