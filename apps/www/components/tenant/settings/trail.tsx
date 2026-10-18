"use client";

import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";

/**
 * The action of a settings card that opens the audit trail, where the changes
 * that the card makes are recorded.
 */
export function SchoolTrailAction() {
  const t = useTranslations("SchoolSettings");

  return (
    <Button
      nativeButton={false}
      render={<NavigationLink href="/settings/audit" />}
      size="sm"
      variant="outline"
    >
      {t("audit-view")}
    </Button>
  );
}
