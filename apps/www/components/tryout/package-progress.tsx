"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { useTranslations } from "next-intl";
import { useTryoutPackageProgress } from "@/components/tryout/providers/package-progress";

export function TryoutPackageInProgressBadge({
  tryoutSlug,
}: {
  tryoutSlug: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const isInProgress = useTryoutPackageProgress((state) =>
    state.has(tryoutSlug)
  );

  if (!isInProgress) {
    return null;
  }

  return (
    <Badge variant="muted">{tTryouts("package-status-in-progress")}</Badge>
  );
}
