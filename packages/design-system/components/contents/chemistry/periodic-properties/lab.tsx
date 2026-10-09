"use client";

import { PeriodicPropertiesCanvas } from "@repo/design-system/components/contents/chemistry/periodic-properties/canvas";
import {
  ATOMIC_RADIUS_MODE_ID,
  isPeriodicPropertyModeId,
  PERIODIC_PROPERTY_MODE_IDS,
  type PeriodicPropertiesFactLabels,
  type PeriodicPropertyModeId,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";

interface PeriodicPropertiesLabProps {
  description: ReactNode;
  labels: {
    chooseTrend: string;
    factLabels: PeriodicPropertiesFactLabels;
    modes: Record<
      PeriodicPropertyModeId,
      {
        cause: ReactNode;
        groupTrend: ReactNode;
        guidance: ReactNode;
        name: string;
        periodTrend: ReactNode;
        question: ReactNode;
        tab: string;
      }
    >;
    sceneLabel: string;
  };
  title: ReactNode;
}

/**
 * Renders an interactive model for the main periodic-property trends.
 */
export function PeriodicPropertiesLab({
  title,
  description,
  labels,
}: PeriodicPropertiesLabProps) {
  const [selectedModeId, setSelectedModeId] = useState<PeriodicPropertyModeId>(
    ATOMIC_RADIUS_MODE_ID
  );
  const selectedLabels = labels.modes[selectedModeId];

  /**
   * Keeps one trend selected when ToggleGroup emits an empty value.
   */
  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isPeriodicPropertyModeId(value)) {
      return;
    }

    setSelectedModeId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseTrend}
          gridColumns="4-lg"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {Arr.map(PERIODIC_PROPERTY_MODE_IDS, (modeId) => (
            <ToggleGroupItem
              aria-label={labels.modes[modeId].name}
              key={modeId}
              value={modeId}
            >
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <PeriodicPropertiesCanvas
          aria-label={labels.sceneLabel}
          modeId={selectedModeId}
        />

        <p className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
          {selectedLabels.guidance}
        </p>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <TrendFact
            label={labels.factLabels.question}
            value={selectedLabels.question}
          />
          <TrendFact
            label={labels.factLabels.period}
            value={selectedLabels.periodTrend}
          />
          <TrendFact
            label={labels.factLabels.group}
            value={selectedLabels.groupTrend}
          />
          <TrendFact
            label={labels.factLabels.cause}
            value={selectedLabels.cause}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Presents one compact fact below the model.
 */
function TrendFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
