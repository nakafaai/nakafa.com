"use client";

import { Flag03Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

export type TryoutStatusValue = "completed";

/** Renders the production try-out row status badge. */
export function TryoutStatus({ status }: { status: TryoutStatusValue }) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <Badge variant="secondary">
      <HugeIcons icon={Flag03Icon} />
      {tTryouts(`part-status-${status}`)}
    </Badge>
  );
}
