import {
  AccelerationLabelsProvider,
  useAccelerationLabels,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/context";
import {
  ACCELERATION_CASES,
  type AccelerationCaseId,
  type AccelerationLabels,
  DEFAULT_ACCELERATION_CASE_ID,
  getAccelerationCaseById,
  isAccelerationCaseId,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { AccelerationGraph } from "@repo/design-system/components/contents/physics/kinematics/acceleration/graph";
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

interface AccelerationGraphCardProps {
  description: ReactNode;
  labels: AccelerationLabels;
  title: ReactNode;
}

/** Creates one card's store, which holds the case its reader picked. */
function createAccelerationCaseStore(initialCaseId: AccelerationCaseId) {
  return createStore(
    combine({ caseId: initialCaseId }, (set) => ({
      selectCase: (caseId: AccelerationCaseId) => set({ caseId }),
    }))
  );
}

export function AccelerationGraphCard({
  title,
  description,
  labels,
}: AccelerationGraphCardProps) {
  const [store] = useState(() =>
    createAccelerationCaseStore(DEFAULT_ACCELERATION_CASE_ID)
  );
  const caseId = useStore(store, (state) => state.caseId);
  const selectCase = useStore(store, (state) => state.selectCase);
  const selectedCase = getAccelerationCaseById(caseId);

  function handleCaseChange(nextCaseId: string) {
    if (nextCaseId && isAccelerationCaseId(nextCaseId)) {
      selectCase(nextCaseId);
    }
  }

  return (
    <AccelerationLabelsProvider labels={labels}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardToolbar>
          <AccelerationCaseToggle
            caseId={caseId}
            onCaseChange={handleCaseChange}
          />
        </VisualCardToolbar>
        <VisualCardBody>
          <AccelerationGraph selectedCase={selectedCase} />
        </VisualCardBody>
        <VisualCardActions>
          <VisualCardFullscreen />
        </VisualCardActions>
      </VisualCard>
    </AccelerationLabelsProvider>
  );
}

function AccelerationCaseToggle({
  caseId,
  onCaseChange,
}: {
  caseId: AccelerationCaseId;
  onCaseChange: (nextCaseId: string) => void;
}) {
  const labels = useAccelerationLabels();

  return (
    <ToggleGroup
      aria-label={labels.chooseCase}
      gridColumns="3"
      onValueChange={onCaseChange}
      type="single"
      value={caseId}
      variant="outline"
    >
      {Arr.map(ACCELERATION_CASES, (item) => (
        <ToggleGroupItem key={item.id} value={item.id}>
          {labels.scenarioNames[item.id]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
