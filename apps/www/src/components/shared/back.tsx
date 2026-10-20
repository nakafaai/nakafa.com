import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useHrefNavigate } from "@repo/internationalization/src/link";
import { useRouter } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

interface BackButtonProps extends ComponentProps<typeof Button> {
  defaultHref?: string;
}

export function BackButton({ defaultHref = "/", ...props }: BackButtonProps) {
  const t = useTranslations("Common");
  const router = useRouter();
  const navigateToHref = useHrefNavigate();

  const handleBack = () => {
    // Check if there's no meaningful history or if we're in a new tab
    // window.history.length <= 2 means only current page and possibly the redirect source
    // document.referrer === "" means opened in new tab/no referrer
    if (
      typeof window !== "undefined" &&
      (window.history.length <= 2 || document.referrer === "")
    ) {
      // Navigate to the public homepage instead of going back to avoid redirect loops.
      navigateToHref(defaultHref);
    } else {
      router.history.back();
    }
  };

  return (
    <Button onClick={handleBack} variant="ghost" {...props}>
      <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
      {t("back")}
    </Button>
  );
}
