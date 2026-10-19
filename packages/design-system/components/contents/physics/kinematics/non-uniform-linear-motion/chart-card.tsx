"use client";

import {
  GlbbLabelsProvider,
  useGlbbLabels,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/context";
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
  VisualCardActions,
  VisualCardBody,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { createStore, useStore } from "zustand";
import { combine } from "zustand/middleware";

interface NonUniformLinearMotionGraphCardProps {
  description: ReactNode;
  labels: GlbbLabels;
  title: ReactNode;
}

/** Creates one card's store, which holds the scenario its reader picked. */
function createGlbbScenarioStore(initialScenarioId: GlbbScenarioId) {
  return createStore(
    combine({ scenarioId: initialScenarioId }, (set) => ({
      selectScenario: (scenarioId: GlbbScenarioId) => set({ scenarioId }),
    }))
  );
}

export function NonUniformLinearMotionGraphCard({
  title,
  description,
  labels,
}: NonUniformLinearMotionGraphCardProps) {
  const [store] = useState(() =>
    createGlbbScenarioStore(DEFAULT_GLBB_SCENARIO_ID)
  );
  const scenarioId = useStore(store, (state) => state.scenarioId);
  const selectScenario = useStore(store, (state) => state.selectScenario);
  const scenario = getGlbbScenarioById(scenarioId);

  function handleScenarioChange(nextScenarioId: string) {
    if (nextScenarioId && isGlbbScenarioId(nextScenarioId)) {
      selectScenario(nextScenarioId);
    }
  }

  return (
    <GlbbLabelsProvider labels={labels}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardToolbar>
          <GlbbScenarioToggle
            onScenarioChange={handleScenarioChange}
            scenarioId={scenarioId}
          />
        </VisualCardToolbar>
        <VisualCardBody>
          <VelocityTimeGraph scenario={scenario} />
        </VisualCardBody>
        <VisualCardActions>
          <VisualCardFullscreen />
        </VisualCardActions>
      </VisualCard>
    </GlbbLabelsProvider>
  );
}

function GlbbScenarioToggle({
  onScenarioChange,
  scenarioId,
}: {
  onScenarioChange: (nextScenarioId: string) => void;
  scenarioId: GlbbScenarioId;
}) {
  const labels = useGlbbLabels();

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
