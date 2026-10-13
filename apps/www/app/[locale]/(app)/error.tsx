"use client"; // Error boundaries must be Client Components

import { captureException } from "@repo/analytics/posthog/browser";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Broken } from "@/components/state/broken";
import { Stage } from "@/components/state/stage";

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
    <Stage>
      <Broken
        description={t("description")}
        home={tState("home-button")}
        homeHref={`/${locale}`}
        retry={t("retry")}
        title={t("title")}
      />
    </Stage>
  );
}
