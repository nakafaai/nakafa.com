"use client";

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
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";
import { useState } from "react";

interface AccelerationGraphCardProps {
  description: ReactNode;
  labels: AccelerationLabels;
  title: ReactNode;
}

export function AccelerationGraphCard({
  title,
  description,
  labels,
}: AccelerationGraphCardProps) {
  const [caseId, setCaseId] = useState<AccelerationCaseId>(
    DEFAULT_ACCELERATION_CASE_ID
  );
  const selectedCase = getAccelerationCaseById(caseId);

  function handleCaseChange(nextCaseId: string) {
    if (nextCaseId && isAccelerationCaseId(nextCaseId)) {
      setCaseId(nextCaseId);
    }
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="flex flex-col gap-4">
        <AccelerationCaseToggle
          caseId={caseId}
          labels={labels}
          onCaseChange={handleCaseChange}
        />
        <VisualCardScene>
          <AccelerationGraph labels={labels} selectedCase={selectedCase} />
        </VisualCardScene>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

function AccelerationCaseToggle({
  caseId,
  labels,
  onCaseChange,
}: {
  caseId: AccelerationCaseId;
  labels: AccelerationLabels;
  onCaseChange: (nextCaseId: string) => void;
}) {
  return (
    <ToggleGroup
      aria-label={labels.chooseCase}
      gridColumns="3"
      onValueChange={onCaseChange}
      type="single"
      value={caseId}
      variant="outline"
    >
      {ACCELERATION_CASES.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id}>
          {labels.scenarioNames[item.id]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
