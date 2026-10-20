import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

/**
 * Keeps back, the title, the timer, and the one primary action in a single row
 * that is as wide as the questions and the navigator beside them.
 */
export function PlayerHeader({ children }: { children: ReactNode }) {
  return (
    <BreadcrumbHeaderFrame contentClassName="gap-2 lg:max-w-5xl">
      {children}
    </BreadcrumbHeaderFrame>
  );
}

/** Leaves the running questions for the page they came from; the timer keeps going. */
export function PlayerBack({ href }: { href: string }) {
  const tCommon = useTranslations("Common");

  return (
    <IntentLink
      aria-label={tCommon("back")}
      className={buttonVariants({ size: "icon", variant: "ghost" })}
      href={href}
    >
      <HugeIcons icon={ArrowLeft01Icon} />
    </IntentLink>
  );
}

/** The page heading; a long title is cut short so the header stays one row. */
export function PlayerTitle({ children }: { children: string }) {
  return (
    <h1
      className="min-w-0 flex-1 truncate font-medium text-base"
      title={children}
    >
      {children}
    </h1>
  );
}
