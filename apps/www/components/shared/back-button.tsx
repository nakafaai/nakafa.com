"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, useCallback } from "react";

interface BackButtonProps extends ComponentProps<typeof Button> {
  defaultHref?: string;
}

export function BackButton({
  defaultHref = "/about",
  ...props
}: BackButtonProps) {
  const t = useTranslations("Common");
  const router = useRouter();

  const handleBack = useCallback(() => {
    // Check if there's no meaningful history or if we're in a new tab
    // window.history.length <= 2 means only current page and possibly the redirect source
    // document.referrer === "" means opened in new tab/no referrer
    if (
      typeof window !== "undefined" &&
      (window.history.length <= 2 || document.referrer === "")
    ) {
      // Navigate to about page instead of going back to avoid redirect loop
      router.push(defaultHref);
    } else {
      router.back();
    }
  }, [router, defaultHref]);

  return (
    <Button onClick={handleBack} variant="ghost" {...props}>
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
      {t("back")}
    </Button>
  );
}
