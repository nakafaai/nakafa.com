import { buttonVariants } from "@repo/design-system/lib/button";
import Link from "next/link";
import { useTranslations } from "use-intl";

/**
 * The action of a settings card that opens the audit trail, where the changes
 * that the card makes are recorded. It is a plain link, because a school host's
 * paths have no locale in front of them.
 */
export function SchoolTrailAction() {
  const t = useTranslations("SchoolSettings");

  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "outline" })}
      href="/settings/audit"
    >
      {t("audit-view")}
    </Link>
  );
}
