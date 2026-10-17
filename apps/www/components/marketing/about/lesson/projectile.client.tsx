"use client";

import { ParabolicMovementLab } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab";
import { useTranslations } from "next-intl";
import type { LessonLabProps } from "@/components/marketing/about/lesson/labs";

/**
 * The projectile lesson's lab: a ball thrown at a chosen angle, in three
 * dimensions. It gets interface labels only; its numbers come from its own data.
 */
export function ProjectileLesson({ decimalSeparator }: LessonLabProps) {
  const t = useTranslations("Landing");

  return (
    <ParabolicMovementLab
      decimalSeparator={decimalSeparator}
      labels={{
        chooseLaunch: t("lab.projectile.choose"),
        factLabels: {
          flightTime: t("lab.projectile.flight-time"),
          initialSpeed: t("lab.projectile.initial-speed"),
          peakHeight: t("lab.projectile.peak-height"),
          range: t("lab.projectile.range"),
        },
        viewLabel: t("lab.projectile.view"),
      }}
    />
  );
}
