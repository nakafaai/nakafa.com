import { Menu02Icon } from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import { PanelSheetTrigger } from "@/components/sidebar/sheet";
import { HOME_TARGET, QURAN_TARGET } from "@/lib/routing/target";

/**
 * A surah's header, as every page's: its path, Home, the Quran and the surah, then
 * its search and its actions at the end. The surah's names and the meaning of its
 * name are its title for assistive technology, and the verses stand under it with
 * no title block. On a phone the path folds as every path does, and the surah's
 * name stays.
 */
export function QuranSurahHeader({
  actions,
  meaning,
  meaningLanguage,
  name,
  quranLabel,
  search,
  title,
}: {
  actions: ReactNode;
  meaning: string;
  /** BCP 47 language of the meaning when it differs from the page. */
  meaningLanguage?: string;
  name: ReactNode;
  quranLabel: string;
  /** The page's search, which finds another surah. */
  search: ReactNode;
  title: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeaderFrame
      className="h-(--surah-header-height)"
      contentClassName="flex-nowrap"
    >
      <h1 className="sr-only">
        {name}{" "}
        <span data-slot="surah-meaning" lang={meaningLanguage}>
          {meaning}
        </span>
      </h1>
      <BreadcrumbHeaderPath
        home={HOME_TARGET}
        homeLabel={tCommon("home")}
        items={[{ label: quranLabel, target: QURAN_TARGET }, { label: title }]}
      />
      <div
        className="flex shrink-0 items-center gap-2"
        data-slot="surah-header-actions"
      >
        {search}
        <ButtonGroup aria-label={tCommon("content-actions")}>
          {actions}
        </ButtonGroup>
        <PanelSheetTrigger icon={Menu02Icon} label={tCommon("on-this-page")} />
      </div>
    </BreadcrumbHeaderFrame>
  );
}
