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
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";

/** Keeps surah navigation, name, and outline actions in one stable page row. */
export function QuranSurahHeader({
  arabic,
  meaning,
  meaningLanguage,
  quranLabel,
  title,
}: {
  arabic: string;
  meaning: string;
  /** BCP 47 language of the meaning when it differs from the page. */
  meaningLanguage?: string;
  quranLabel: string;
  title: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeaderFrame contentClassName="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="col-span-2 min-w-0 md:col-span-1">
        <BreadcrumbHeaderPath
          homeLabel={tCommon("home")}
          items={[
            { href: "/quran", label: quranLabel },
            { label: meaning, language: meaningLanguage },
          ]}
          menuLabel={tCommon("more")}
          visibleItemCount={2}
        />
      </div>
      <h1
        className="flex min-w-0 items-baseline gap-2 truncate font-medium text-base md:max-w-xs md:justify-center md:text-center"
        title={title}
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className="shrink-0 font-quran text-xl" dir="rtl" lang="ar">
          {arabic}
        </span>
      </h1>
      <div className="flex min-w-0 justify-end">
        <ButtonGroup aria-label={tCommon("content-actions")}>
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
