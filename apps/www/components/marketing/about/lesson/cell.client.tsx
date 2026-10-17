"use client";

import { BacteriaStructureLab } from "@repo/design-system/components/contents/biology/bacteria";
import { useTranslations } from "next-intl";
import { getCellLabels } from "@/components/marketing/about/lesson/labels";
import { useLessonSelection } from "@/components/marketing/about/lesson/selection";

/** The cell lesson's lab: the shape, the inside and the wall of a bacterium. */
export function CellLesson() {
  const t = useTranslations("Landing");
  const defaultItemIndex = useLessonSelection((state) => state.cellItem);
  const onItemIndexChange = useLessonSelection((state) => state.setCellItem);

  return (
    <BacteriaStructureLab
      defaultItemIndex={defaultItemIndex ?? undefined}
      labels={getCellLabels(t)}
      onItemIndexChange={onItemIndexChange}
    />
  );
}
