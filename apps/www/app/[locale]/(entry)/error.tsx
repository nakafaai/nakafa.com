"use client";

import { captureException } from "@repo/analytics/posthog/browser";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Theme } from "@/components/marketing/shared/footer-action";
import {
  EntryShellBody,
  EntryShellHeader,
} from "@/components/shared/entry-shell";

/** Keeps entry failures on a localized, recoverable Nakafa surface. */
export default function EntryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Auth");

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
          <Theme variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="space-y-2">
            <h1 className="font-semibold text-xl">{t("entry-error-title")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("entry-error-description")}
            </p>
          </div>
          <Button onClick={reset}>{t("retry")}</Button>
        </div>
      </EntryShellBody>
    </>
  );
}
