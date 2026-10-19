import { Button } from "@repo/design-system/components/ui/button";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The sentence and the retry of a sitting call that failed for a reason other than its visibility. The
 * failure is reported once, and the student reloads the page. Every screen of a sitting shows it in its
 * own frame, so a failed read never leaves the student without a control.
 */
export function SittingRetry({ error }: { readonly error: unknown }) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");

  useEffect(() => {
    Effect.runSync(
      reportClientException(error, {
        source: "components/exams/sitting/retry",
      })
    );
  }, [error]);

  return (
    <>
      <p>{t("student-retry")}</p>
      <Button
        onClick={() => window.location.reload()}
        type="button"
        variant="outline"
      >
        {tCommon("retry")}
      </Button>
    </>
  );
}
