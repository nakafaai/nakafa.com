"use client";

import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "next-intl";
import { useTenant } from "@/components/tenant/context";
import { DAY_PART_ACT } from "@/components/tenant/home/greeting";

/**
 * The greeting of the school home as a title row, not a card: Nina at 40 pixels beside "Good evening, {name}" at
 * 24 pixels. The school layout computes the greeting on the server, so the name and Nina's act are in the first
 * HTML and nothing inserts after hydration. The title line keeps its height, so the row holds its place.
 */
export function HomeTitle() {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <div className="flex items-center gap-3">
      <Nina act={DAY_PART_ACT[greeting.part]} label="" size={40} whole />
      <h2 className="min-h-8 font-medium text-2xl">
        {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
      </h2>
    </div>
  );
}
