"use client";

import { useTryoutPackageProgress } from "@/components/tryout/providers/package-progress";
import { TryoutStatusBadge } from "@/components/tryout/status-badge";

export function TryoutPackageStatusBadge({
  tryoutSlug,
}: {
  tryoutSlug: string;
}) {
  const status = useTryoutPackageProgress((state) => state.get(tryoutSlug));

  if (!status) {
    return null;
  }

  return <TryoutStatusBadge status={status} />;
}
