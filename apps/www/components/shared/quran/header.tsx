"use client";

import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";

/**
 * Keeps surah navigation, name, and outline actions in one stable page row. The
 * page composes the name and the actions, and the row places them.
 */
export function QuranSurahHeader({
  actions,
  meaning,
  meaningLanguage,
  name,
  quranLabel,
  title,
}: {
  actions: ReactNode;
  meaning: string;
  /** BCP 47 language of the meaning when it differs from the page. */
  meaningLanguage?: string;
  name: ReactNode;
  quranLabel: string;
  title: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeaderFrame
      className="h-(--surah-header-height)"
      contentClassName="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
    >
      <div className="col-start-1 row-start-1 min-w-0 md:col-span-1">
        <BreadcrumbHeaderPath
          homeHref="/home"
          homeLabel={tCommon("home")}
          items={[{ href: "/quran", label: quranLabel }]}
          menuLabel={tCommon("more")}
        />
      </div>
      <h1
        className="col-span-2 col-start-1 row-start-2 flex h-8 min-w-0 items-baseline gap-2 truncate font-medium text-base md:col-span-1 md:col-start-2 md:row-start-1 md:h-auto md:justify-center md:text-center"
        title={`${title}: ${meaning}`}
      >
        <span
          className="sr-only"
          data-slot="surah-meaning"
          lang={meaningLanguage}
        >
          {meaning}
        </span>
        {name}
      </h1>
      <div
        className="col-start-2 row-start-1 flex min-w-0 justify-end md:col-start-3"
        data-slot="surah-header-actions"
      >
        <ButtonGroup aria-label={tCommon("content-actions")}>
          {actions}
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarTrigger
                  aria-label={tCommon("on-this-page")}
                  className="size-9"
                  icon={Menu02Icon}
                  size="icon"
                  variant="outline"
                />
              }
            />
            <TooltipContent side="bottom">
              {tCommon("on-this-page")}
            </TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </div>
    </BreadcrumbHeaderFrame>
  );
}
