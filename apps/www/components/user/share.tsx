"use client";

import { Share01Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { reportClientException } from "@/lib/analytics/client";
import { isShareCancel, profileUrl } from "@/lib/profile/share";

/**
 * Shares the address of a profile. The system share sheet opens where the
 * browser has one. Elsewhere the address is copied, and a toast confirms it.
 */
export function ShareProfileButton({ username }: { username: string }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const clipboard = useClipboard();

  /** Shares the address, or copies it where the browser has no share sheet. */
  function handleShare() {
    const url = profileUrl(locale, username);
    if ("share" in navigator) {
      Effect.runPromise(shareAddress(url));
      return;
    }
    clipboard.copy(url);
    toast.success(
      { title: "link-copied.title" },
      { position: "bottom-center" }
    );
  }

  return (
    <Button className="flex-1" onClick={handleShare} variant="outline">
      <HugeIcons icon={Share01Icon} />
      {t("share-profile")}
    </Button>
  );
}

/**
 * Opens the system share sheet with the address. A closed sheet is no failure,
 * and any other failure is reported.
 */
function shareAddress(url: string) {
  return Effect.tryPromise(() => navigator.share({ url })).pipe(
    Effect.matchEffect({
      onSuccess: () => Effect.void,
      onFailure: (error) =>
        isShareCancel(error.cause)
          ? Effect.void
          : reportClientException(error, { source: "components/user/share" }),
    })
  );
}
