"use client"; // Error boundaries must be Client Components

import { captureException } from "@repo/analytics/posthog/capture";
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

export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useTranslations("Error");
  const tState = useTranslations("State");
  const locale = useLocale();

  useEffect(() => {
    captureException(error, {
      source: "next-segment-error",
      ...(error.digest ? { nextjs_digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <Failure
      description={t("description")}
      home={tState("home-button")}
      homeHref={`/${locale}`}
      retry={t("retry")}
      title={t("title")}
    />
  );
}
