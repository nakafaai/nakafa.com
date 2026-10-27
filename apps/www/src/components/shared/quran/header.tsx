import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import {
  BreadcrumbHeaderFold,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import { HOME_TARGET, QURAN_TARGET } from "@/lib/routing/target";

/**
 * Keeps surah navigation, name, and outline actions in one row at every width. On a
 * phone the path folds into its menu, as Google Drive folds it, and the surah's name
 * sits beside it without its Arabic, which the page shows; from md the path, the name
 * and the actions stand apart. The page composes the name and the actions, and the row
 * places them.
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
      contentClassName="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4"
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <BreadcrumbHeaderFold
          className="md:hidden"
          home={HOME_TARGET}
          homeLabel={tCommon("home")}
          items={[
            {
              label: quranLabel,
              target: QURAN_TARGET,
            },
          ]}
        />
        <div className="min-w-0 max-md:hidden">
          <BreadcrumbHeaderPath
            home={HOME_TARGET}
            homeLabel={tCommon("home")}
            items={[
              {
                label: quranLabel,
                target: QURAN_TARGET,
              },
            ]}
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
        {name}
      </h1>
      <div
        className="col-start-3 row-start-1 flex justify-end"
        data-slot="surah-header-actions"
      >
        <ButtonGroup aria-label={tCommon("content-actions")}>
          {actions}
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
