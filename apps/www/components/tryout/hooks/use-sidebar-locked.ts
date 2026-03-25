"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { useLocale } from "next-intl";
import { useTryoutAttempt } from "@/components/tryout/hooks/use-tryout-attempt";
import { getTryoutAttemptRoute } from "@/components/tryout/utils/route";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";

/** Returns whether the current route belongs to an active tryout. */
export function useTryoutSidebarLocked() {
  const locale = useLocale();
  const pathname = usePathname();
  const route = getTryoutAttemptRoute(pathname);
  const tryoutParams = route
    ? {
        locale,
        product: route.product,
        tryoutSlug: route.tryoutSlug,
      }
    : null;
  const { data: attempt, nowMs } = useTryoutAttempt(tryoutParams);

  if (!attempt) {
    return false;
  }

  return (
    getEffectiveTryoutStatus({
      expiresAtMs: attempt.expiresAtMs,
      nowMs,
      status: attempt.attempt.status,
    }) === "in-progress"
  );
}
