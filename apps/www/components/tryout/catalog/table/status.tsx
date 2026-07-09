"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { useTranslations } from "next-intl";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

/** Renders the latest attempt state for one discoverable try-out set. */
export function TryoutSetTableStatus({
  status,
}: {
  status: TryoutSetRow["attemptStatus"];
}) {
  const tTryouts = useTranslations("Tryouts");

  if (status === "in-progress") {
    return (
      <Badge variant="default-subtle">
        {tTryouts("set-status-in-progress")}
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge variant="secondary">{tTryouts("set-status-completed")}</Badge>
    );
  }

  if (status === "expired") {
    return (
      <Badge variant="destructive-subtle">
        {tTryouts("set-status-expired")}
      </Badge>
    );
  }

  return <Badge variant="muted">{tTryouts("set-status-not-started")}</Badge>;
}
