"use client"; // Error boundaries must be Client Components

import { captureException } from "@repo/analytics/posthog/browser";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Broken } from "@/components/state/broken";
import { Stage } from "@/components/state/stage";
import { isLostAccess } from "@/components/tenant/refusal";
import { TenantRefused } from "@/components/tenant/refused";

/**
 * Keeps a school failure on the school's own surface, the one its not-found page
 * uses. The boundary sits above the school layout, so the school shell may be the
 * part that failed. The quiet way on leads to Nakafa, because the school's root
 * may fail again, as the school's not-found page explains.
 *
 * A viewer who has lost the school's access gets the refused page instead. That
 * answer is expected, so it is not reported as a failure.
 */
export default function SchoolError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useTranslations("Error");
  const tState = useTranslations("State");
  const locale = useLocale();
  const homeHref = new URL(`/${locale}`, SITE_ORIGIN).href;
  const refused = isLostAccess(error);

  useEffect(() => {
    if (refused) {
      return;
    }
    captureException(error, {
      source: "school-segment-error",
      ...(error.digest ? { nextjs_digest: error.digest } : {}),
    });
  }, [error, refused]);

  if (refused) {
    return (
      <Stage>
        <TenantRefused homeHref={homeHref} />
      </Stage>
    );
  }
  return (
    <Stage>
      <Broken
        description={t("description")}
        home={tState("home-button")}
        homeHref={homeHref}
        retry={t("retry")}
        title={t("title")}
      />
    </Stage>
  );
}
