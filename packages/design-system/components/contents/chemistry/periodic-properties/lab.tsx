"use client";

import { PeriodicPropertiesCanvas } from "@repo/design-system/components/contents/chemistry/periodic-properties/canvas";
import {
  ATOMIC_RADIUS_MODE_ID,
  getPeriodicPropertyModeColor,
  isPeriodicPropertyModeId,
  PERIODIC_PROPERTY_MODE_IDS,
  type PeriodicPropertiesLabProps,
  type PeriodicPropertyModeId,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * Renders an interactive 3D model for the main periodic-property trends.
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
  const selectedColor = getPeriodicPropertyModeColor(selectedModeId);

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
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseTrend}
          className="grid w-full grid-cols-2 lg:grid-cols-4"
          layout="grid"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {PERIODIC_PROPERTY_MODE_IDS.map((modeId) => (
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
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <TrendFact
            label={labels.factLabels.question}
            markerColor={selectedColor}
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
      </CardFooter>
    </Card>
  );
}

/**
 * Presents one compact fact below the 3D model.
 */
function TrendFact({
  label,
  markerColor,
  value,
}: {
  label: string;
  markerColor?: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-muted-foreground text-sm">
        {markerColor && (
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: markerColor }}
          />
        )}
        {label}
      </dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}
