import { ModernPeriodicTableCanvas } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/canvas";
import {
  GROUP_ONE_FOCUS_ID,
  getModernPeriodicTableCategoryColor,
  getModernPeriodicTableSceneColors,
  getPeriodicElementCategoryCount,
  isModernPeriodicTableFocusId,
  MODERN_PERIODIC_TABLE_FOCUS_IDS,
  type ModernPeriodicTableFocusId,
  PERIODIC_ELEMENT_CATEGORY_IDS,
  type PeriodicElementCategoryId,
  type PeriodicSeriesRowKey,
} from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import { createModernPeriodicTableFocusStore } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/store";
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
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";

export interface ModernPeriodicTableLabProps {
  description: ReactNode;
  labels: {
    atomicNumber: string;
    categoryNames: Record<PeriodicElementCategoryId, string>;
    chooseFocus: string;
    focuses: Record<
      ModernPeriodicTableFocusId,
      {
        detail: ReactNode;
        name: string;
        tab: string;
      }
    >;
    focusLabel: string;
    group: string;
    period: string;
    periodPrefix: string;
    seriesNames: Record<PeriodicSeriesRowKey, string>;
    tableLabel: string;
  };
  title: ReactNode;
}

/**
 * Renders a 3D reader for the modern periodic table.
 */
export function ModernPeriodicTableLab({
  title,
  description,
  labels,
}: ModernPeriodicTableLabProps) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const [store] = useState(() =>
    createModernPeriodicTableFocusStore(GROUP_ONE_FOCUS_ID)
  );
  const selectedFocusId = useStore(store, (state) => state.focusId);
  const selectFocus = useStore(store, (state) => state.selectFocus);
  const colors = getModernPeriodicTableSceneColors(resolvedTheme);
  const selectedLabels = labels.focuses[selectedFocusId];
  const t = useTranslations("Common");
  const format = useFormatter();

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

    selectFocus(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFocus}
          gridColumns="3"
          onValueChange={handleFocusChange}
          type="single"
          value={selectedFocusId}
          variant="outline"
        >
          {Arr.map(MODERN_PERIODIC_TABLE_FOCUS_IDS, (focusId) => (
            <ToggleGroupItem
              aria-label={labels.focuses[focusId].name}
              key={focusId}
              value={focusId}
            >
              {labels.focuses[focusId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <ModernPeriodicTableCanvas
        aria-label={labels.tableLabel}
        labels={labels}
        store={store}
      />

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.focusLabel} value={selectedLabels.name} />
          <VisualFact label={t("note")} value={selectedLabels.detail} />
          {Arr.map(PERIODIC_ELEMENT_CATEGORY_IDS, (categoryId) => (
            <VisualFactIndicator
              indicatorColor={getModernPeriodicTableCategoryColor(
                colors,
                categoryId
              )}
              key={categoryId}
              label={labels.categoryNames[categoryId]}
              value={format.number(
                getPeriodicElementCategoryCount(categoryId),
                { useGrouping: false }
              )}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
