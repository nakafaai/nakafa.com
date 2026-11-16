import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { LANDING_TARGET } from "@/lib/routing/target";

/** Goes back a page, or to the landing page when the tab has no page to go back to. */
export function BackButton(
  props: Omit<ComponentProps<typeof Button>, "size" | "tooltip">
) {
  const t = useTranslations("Common");
  const router = useRouter();
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if there's no meaningful history or if we're in a new tab
    // window.history.length <= 2 means only current page and possibly the redirect source
    // document.referrer === "" means opened in new tab/no referrer
    if (
      typeof window !== "undefined" &&
      (window.history.length <= 2 || document.referrer === "")
    ) {
      // Navigate to the public homepage instead of going back to avoid redirect loops.
      navigate(LANDING_TARGET);
    } else {
      router.history.back();
    }
  };

  return (
    <Button onClick={handleBack} variant="ghost" {...props}>
      <HugeIcons icon={ArrowLeft02Icon} />
      {t("back")}
    </Button>
  );
}
