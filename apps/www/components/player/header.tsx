"use client";

import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { usePlayer } from "@/components/player/context";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

/** Keeps back, title, timer, and the one primary action in one row. */
export function PlayerHeader({ children }: { readonly children: ReactNode }) {
  return (
    <BreadcrumbHeaderFrame contentClassName="gap-2 lg:max-w-5xl">
      {children}
    </BreadcrumbHeaderFrame>
  );
}

/** Leaves the running questions for the attempt page; the timer keeps going. */
export function PlayerBack() {
  const tCommon = useTranslations("Common");
  const backHref = usePlayer((session) => session.meta.backHref);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={tCommon("back")}
            nativeButton={false}
            render={<IntentLink href={backHref} />}
            size="icon"
            variant="ghost"
          >
            <HugeIcons icon={ArrowLeft01Icon} />
          </Button>
        }
      />
      <TooltipContent side="bottom">
        <p>{tCommon("back")}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** The page heading; long titles truncate so the row never wraps. */
export function PlayerTitle() {
  const title = usePlayer((session) => session.meta.title);
  return (
    <h1 className="min-w-0 flex-1 truncate font-medium text-base" title={title}>
      {title}
    </h1>
  );
}
