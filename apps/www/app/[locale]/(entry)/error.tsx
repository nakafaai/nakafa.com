"use client";

import { captureException } from "@repo/analytics/posthog/capture";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";

/** The failure screen loads when a failure reaches it, so the segment's own code stays small. */
const Broken = dynamic(
  () => import("@/components/state/broken").then((module) => module.Broken),
  { ssr: true }
);

/** Keeps entry failures on a localized, recoverable Nakafa surface. */
export default function EntryError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useTranslations("Error");
  const tState = useTranslations("State");
  const locale = useLocale();

  useEffect(() => {
    captureException(error, {
      source: "entry-segment-error",
      ...(error.digest ? { nextjs_digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <Broken
          description={t("description")}
          home={tState("home-button")}
          homeHref={`/${locale}`}
          retry={t("retry")}
          title={t("title")}
        />
      </EntryShellBody>
    </>
  );
}
