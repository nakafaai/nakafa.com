"use client";

import { buttonVariants } from "@repo/design-system/lib/button";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { TableEmpty } from "@/components/shared/table/frame";

/**
 * The state of a school page that belongs to an active unit, while the school has none: Nina
 * pointing at the units, one sentence on why, and the way to restore or add one.
 */
export function NoActiveUnit() {
  const t = useTranslations("SchoolSettings");

  return (
    <TableEmpty
      act="pointing"
      action={
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/settings/units"
        >
          {t("no-unit-action")}
        </Link>
      }
      description={t("no-unit-description")}
      title={t("no-unit-title")}
    />
  );
}
