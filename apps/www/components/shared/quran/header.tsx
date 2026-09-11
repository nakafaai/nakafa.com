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
import { AiMenuItem } from "@/components/ai/menu";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import { OpenContent } from "@/components/shared/open-content/actions";

/** Keeps surah navigation, name, and outline actions in one stable page row. */
export function QuranSurahHeader({
  arabic,
  copySourceUrl,
  meaning,
  meaningLanguage,
  quranLabel,
  slug,
  title,
}: {
  arabic: string;
  copySourceUrl: string;
  meaning: string;
  /** BCP 47 language of the meaning when it differs from the page. */
  meaningLanguage?: string;
  quranLabel: string;
  slug: string;
  title: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeaderFrame contentClassName="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="col-start-1 row-start-1 min-w-0 md:col-span-1">
        <BreadcrumbHeaderPath
          homeLabel={tCommon("home")}
          items={[{ href: "/quran", label: quranLabel }]}
          menuLabel={tCommon("more")}
        />
      </div>
      <h1
        className="col-span-2 col-start-1 row-start-2 flex min-w-0 items-baseline gap-2 truncate font-medium text-base md:col-span-1 md:col-start-2 md:row-start-1 md:justify-center md:text-center"
        title={`${title} — ${meaning}`}
      >
        <span
          className="sr-only"
          data-slot="surah-meaning"
          lang={meaningLanguage}
        >
          {meaning}
        </span>
        <span className="min-w-0 truncate">{title}</span>
        <span
          className="shrink-0 font-normal font-quran text-xl"
          dir="rtl"
          lang="ar"
        >
          {arabic}
        </span>
      </h1>
      <div
        className="col-start-2 row-start-1 flex min-w-0 justify-end md:col-start-3"
        data-slot="surah-header-actions"
      >
        <ButtonGroup aria-label={tCommon("content-actions")}>
          <OpenContent copySourceUrl={copySourceUrl} slug={slug}>
            <AiMenuItem contextTitle={title} />
          </OpenContent>
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
