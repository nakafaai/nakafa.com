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
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import {
  BreadcrumbHeaderFold,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import { OpenContent } from "@/components/shared/content/actions";
import { QuranSurahName } from "@/components/shared/quran/name";

/**
 * Keeps surah navigation, name, and outline actions in one row at every width. On a
 * phone the path folds into its menu, as Google Drive folds it, and the surah's name
 * sits beside it without its Arabic, which the page shows; from md the path, the name
 * and the actions stand apart.
 */
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
    <BreadcrumbHeaderFrame
      className="h-(--surah-header-height)"
      contentClassName="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4"
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <BreadcrumbHeaderFold
          className="md:hidden"
          homeHref="/home"
          homeLabel={tCommon("home")}
          items={[{ href: "/quran", label: quranLabel }]}
          menuLabel={tCommon("more")}
        />
        <div className="min-w-0 max-md:hidden">
          <BreadcrumbHeaderPath
            homeHref="/home"
            homeLabel={tCommon("home")}
            items={[{ href: "/quran", label: quranLabel }]}
            menuLabel={tCommon("more")}
          />
        </div>
      </div>
      <h1
        className="col-start-2 row-start-1 flex min-w-0 items-baseline gap-2 font-medium text-base md:justify-center md:text-center max-sm:[&_[lang=ar]]:hidden"
        title={`${title}: ${meaning}`}
      >
        <span
          className="sr-only"
          data-slot="surah-meaning"
          lang={meaningLanguage}
        >
          {meaning}
        </span>
        <QuranSurahName arabic={arabic} title={title} />
      </h1>
      <div
        className="col-start-3 row-start-1 flex justify-end"
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
                  className="size-9"
                  icon={Menu02Icon}
                  label={tCommon("on-this-page")}
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
