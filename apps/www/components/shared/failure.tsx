"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

/** Keeps already loaded content visible when its next read fails. */
export function DataFailure() {
  const t = useTranslations("Common");
  return (
    <Alert variant="destructive">
      <HugeIcons icon={Alert02Icon} />
      <AlertDescription>{t("load-error")}</AlertDescription>
    </Alert>
  );
}
