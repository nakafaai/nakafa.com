import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";

/**
 * The action of a settings card that opens the audit trail, where the changes
 * that the card makes are recorded. It is a plain link, because a school host's
 * paths have no locale in front of them.
 */
export function SchoolTrailAction() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");

  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "outline" })}
      params={{ slug }}
      to="/school/$slug/settings/audit"
    >
      {t("audit-view")}
    </Link>
  );
}
