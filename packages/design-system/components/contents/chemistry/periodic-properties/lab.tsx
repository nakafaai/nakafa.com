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
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "use-intl";

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
  const t = useTranslations("Common");

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

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <PeriodicPropertiesCanvas
        aria-label={labels.sceneLabel}
        modeId={selectedModeId}
      />

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.guidance} />
          <VisualFact
            label={labels.factLabels.question}
            value={selectedLabels.question}
          />
          <VisualFact
            label={labels.factLabels.period}
            value={selectedLabels.periodTrend}
          />
          <VisualFact
            label={labels.factLabels.group}
            value={selectedLabels.groupTrend}
          />
          <VisualFact
            label={labels.factLabels.cause}
            value={selectedLabels.cause}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
