"use client";

import { ModernPeriodicTableCanvas } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/canvas";
import {
  GROUP_ONE_FOCUS_ID,
  getModernPeriodicTableCategoryColor,
  getModernPeriodicTableSceneColors,
  isModernPeriodicTableFocusId,
  MODERN_PERIODIC_TABLE_FOCUS_IDS,
  type ModernPeriodicTableFocusId,
  type ModernPeriodicTableLabProps,
  type ModernPeriodicTableSceneColors,
  PERIODIC_ELEMENT_CATEGORY_IDS,
} from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Badge } from "@repo/design-system/components/ui/badge";
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
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * Renders a 3D reader for the modern periodic table.
 */
export function ModernPeriodicTableLab({
  title,
  description,
  labels,
}: ModernPeriodicTableLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedFocusId, setSelectedFocusId] =
    useState<ModernPeriodicTableFocusId>(GROUP_ONE_FOCUS_ID);
  const colors = getModernPeriodicTableSceneColors(resolvedTheme);
  const selectedLabels = labels.focuses[selectedFocusId];

  /**
   * Keeps one focus selected when ToggleGroup emits an empty value.
   */
  function handleFocusChange(value: string) {
    if (!value) {
      return;
    }

    if (!isModernPeriodicTableFocusId(value)) {
      return;
    }

    setSelectedFocusId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseFocus}
          className="grid w-full grid-cols-2 lg:grid-cols-3"
          layout="grid"
          onValueChange={handleFocusChange}
          type="single"
          value={selectedFocusId}
          variant="outline"
        >
          {MODERN_PERIODIC_TABLE_FOCUS_IDS.map((focusId) => (
            <ToggleGroupItem
              aria-label={labels.focuses[focusId].name}
              key={focusId}
              value={focusId}
            >
              {labels.focuses[focusId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ModernPeriodicTableCanvas
          aria-label={labels.tableLabel}
          focusId={selectedFocusId}
          labels={labels}
        />

        <p className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
          {selectedLabels.detail}
        </p>

        <Legend colors={colors} labels={labels} />
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <LabFact label={labels.focusLabel} value={selectedLabels.name} />
          <LabFact label={labels.group} value={<InlineMath math="1-18" />} />
          <LabFact label={labels.period} value={<InlineMath math="1-7" />} />
          <LabFact
            label={labels.atomicNumber}
            value={<InlineMath math="Z" />}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Presents one compact fact below the 3D model.
 */
function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Shows the element-category colors used by the 3D blocks.
 */
function Legend({
  colors,
  labels,
}: {
  colors: ModernPeriodicTableSceneColors;
  labels: ModernPeriodicTableLabProps["labels"];
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-2 text-xs">
      {PERIODIC_ELEMENT_CATEGORY_IDS.map((categoryId) => (
        <Badge
          className="min-w-32 max-w-full justify-center gap-2 overflow-visible whitespace-normal px-3 py-1 text-center text-muted-foreground leading-snug sm:min-w-40 sm:whitespace-nowrap"
          key={categoryId}
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{
              backgroundColor: getModernPeriodicTableCategoryColor(
                colors,
                categoryId
              ),
            }}
          />
          {labels.categoryNames[categoryId]}
        </Badge>
      ))}
    </div>
  );
}
