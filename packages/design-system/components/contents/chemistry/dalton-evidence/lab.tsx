"use client";

import {
  CONSERVATION_MODE_ID,
  DALTON_LAYOUTS,
  DALTON_MODE_IDS,
  type DaltonEvidenceLabLabels,
  type DaltonModeId,
  isDaltonModeId,
} from "@repo/design-system/components/contents/chemistry/dalton-evidence/data";
import { DaltonEvidenceScene } from "@repo/design-system/components/contents/chemistry/dalton-evidence/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
} from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";
import { useState } from "react";

interface DaltonEvidenceLabProps {
  description: ReactNode;
  labels: DaltonEvidenceLabLabels;
  title: ReactNode;
}

/**
 * Renders a compact lab for Dalton's evidence from mass patterns.
 *
 * The chemical layouts stay in data.ts, while MDX owns the localized copy.
 */
export function DaltonEvidenceLab({
  title,
  description,
  labels,
}: DaltonEvidenceLabProps) {
  const [selectedModeId, setSelectedModeId] =
    useState<DaltonModeId>(CONSERVATION_MODE_ID);
  const selectedLayout = DALTON_LAYOUTS[selectedModeId];
  const selectedLabels = labels.modes[selectedModeId];

  /**
   * Keeps the current mode selected when ToggleGroup emits an empty value.
   */
  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isDaltonModeId(value)) {
      return;
    }

    setSelectedModeId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="flex flex-col gap-5">
        <ToggleGroup
          aria-label={labels.chooseMode}
          gridColumns="3"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {DALTON_MODE_IDS.map((modeId) => (
            <ToggleGroupItem key={modeId} value={modeId}>
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <DaltonEvidenceScene
          afterMolecules={selectedLayout.after}
          afterTitle={selectedLabels.afterTitle}
          beforeMolecules={selectedLayout.before}
          beforeTitle={selectedLabels.beforeTitle}
          expression={selectedLabels.expression}
        />
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          {selectedLabels.facts.map((fact) => (
            <LabFact
              key={fact.label}
              label={fact.label}
              value={<InlineMath math={fact.value} />}
            />
          ))}
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Renders one compact ratio fact in the lab footer.
 */
function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
