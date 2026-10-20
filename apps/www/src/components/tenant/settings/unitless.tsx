import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@repo/internationalization/src/link";
import { useTranslations } from "use-intl";
import { TableEmpty } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";

/**
 * The state of a school page that belongs to an active unit, while the school has none: Nina
 * pointing at the units, one sentence on why, and the way to restore or add one.
 */
export function NoActiveUnit() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");

  return (
    <TableEmpty
      act="pointing"
      action={
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ slug }}
          to="/school/$slug/settings/units"
        >
          {t("no-unit-action")}
        </Link>
      }
      description={t("no-unit-description")}
      title={t("no-unit-title")}
    />
  );
}
