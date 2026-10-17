"use client";

import { UnitCircleCard } from "@repo/design-system/components/contents/mathematics/unit-circle";
import { useTranslations } from "next-intl";

/** The circle lesson's lab: the unit circle, with its angle controls. */
export function CircleLesson() {
  const t = useTranslations("Landing");

  return <UnitCircleCard viewLabel={t("lab.circle.view")} />;
}
