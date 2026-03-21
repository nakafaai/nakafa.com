"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { useLocale } from "next-intl";
import { useUserTryoutAttempt } from "@/components/tryout/hooks/use-user-tryout-attempt";
import { getTryoutAttemptRoute } from "@/components/tryout/utils/route";

/**
 * Hides the main sidebar while the current tryout is still in progress.
 */
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
  const { data: attempt } = useUserTryoutAttempt(tryoutParams);

  return attempt?.attempt.status === "in-progress";
}
