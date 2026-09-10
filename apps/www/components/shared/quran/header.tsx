"use client";

import { useTranslations } from "next-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";

/** Keeps surah navigation, transliterated name, and Arabic title in one stable page row. */
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
        className="min-w-0 truncate font-medium text-base md:max-w-xs md:text-center"
        title={title}
      >
        {title}
      </h1>
      <div className="flex min-w-0 justify-end">
        <span
          className="min-w-0 truncate font-quran text-xl"
          dir="rtl"
          lang="ar"
        >
          {arabic}
        </span>
      </div>
    </BreadcrumbHeaderFrame>
  );
}
