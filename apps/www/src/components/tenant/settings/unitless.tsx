import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";

/**
 * The state of a school page that belongs to an active unit, while the school has none: Nina
 * pointing at the units, one sentence on why, and the way to restore or add one.
 */
export function NoActiveUnit() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const tCommon = useTranslations("Common");

  return (
    <EmptyState
      action={
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ slug }}
          to="/school/$slug/settings/units"
        >
          {tCommon("open-units")}
        </Link>
      }
      description={t("no-unit-description")}
      scene={<EmptyNina act="pointing" />}
      title={t("no-unit-title")}
    />
  );
}
