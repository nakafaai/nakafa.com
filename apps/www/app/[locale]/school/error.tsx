"use client"; // Error boundaries must be Client Components

import { captureException } from "@repo/analytics/posthog/capture";
import { SITE_ORIGIN } from "@repo/seo/origin";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

/** The failure screen loads when a failure reaches it, so the segment's own code stays small. */
const Failure = dynamic(
  () =>
    import("@/components/state/failure.client").then(
      (module) => module.Failure
    ),
  { ssr: true }
);

/**
 * Keeps a school failure on the school's own surface, the one its not-found page
 * uses. The boundary sits above the school layout, so the school shell may be the
 * part that failed. The quiet way on leads to Nakafa, because the school's root
 * may fail again, as the school's not-found page explains.
 */
export default function SchoolError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useTranslations("Error");
  const tState = useTranslations("State");
  const locale = useLocale();

  useEffect(() => {
    captureException(error, {
      source: "school-segment-error",
      ...(error.digest ? { nextjs_digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <Failure
      description={t("description")}
      home={tState("home-button")}
      homeHref={new URL(`/${locale}`, SITE_ORIGIN).href}
      retry={t("retry")}
      title={t("title")}
    />
  );
}
