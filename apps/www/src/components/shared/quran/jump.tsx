import { useMediaQuery } from "@mantine/hooks";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { useNavigate } from "@tanstack/react-router";
import { use, useState } from "react";
import { useTranslations } from "use-intl";
import {
  QuranSurahSearchField,
  QuranSurahSearchIcon,
} from "@/components/shared/quran/search";
import { QuranSurahNumber } from "@/components/shared/quran/surah";
import { QuranSurahsContext } from "@/components/shared/quran/surahs";
import { type QuranIndexSurah, searchSurahs } from "@/lib/content/quran/search";
import { quranSurahTarget } from "@/lib/routing/target";

/** One surah a search keeps: its number, its two names and the meaning of its name. Choosing it opens the surah. */
function QuranSurahOption({ surah }: { surah: typeof QuranIndexSurah.Type }) {
  const navigate = useNavigate();

  return (
    <PickerItem
      icon={<QuranSurahNumber number={surah.number} />}
      onClick={() => navigate(quranSurahTarget(surah.number))}
      value={surah}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{surah.title}</span>
          <span className="font-quran-line shrink-0" dir="rtl" lang="ar">
            {surah.arabic}
          </span>
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {surah.meaning}
        </span>
      </span>
    </PickerItem>
  );
}

/**
 * The surah picker of a surah page's header, which the press on its search
 * loads and opens: the surahs whose number, names or meaning hold the words of
 * its search, the first one highlighted, in a popover under the field on a wide
 * screen and in a drawer on a phone. The arrows move through them, and Enter or
 * a press opens one. Its search starts empty at every opening.
 */
export function QuranSurahPicker() {
  const t = useTranslations("Holy");
  const surahs = use(QuranSurahsContext);
  const [text, setText] = useState("");
  // The picker's own surface reads the same width, so the trigger matches the popover or the drawer.
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.mdAndUp, undefined, {
    getInitialValueInEffect: false,
  });

  return (
    <Picker defaultOpen search={{ onTextChange: setText, text }}>
      <PickerTrigger
        render={wide ? <QuranSurahSearchField /> : <QuranSurahSearchIcon />}
      />
      <PickerContent
        empty={t("surah-empty")}
        items={searchSurahs(text, surahs)}
        itemToStringValue={(surah) => surah.title}
        label={t("menu-surah")}
        placeholder={t("search-surah")}
      >
        {(surah) => <QuranSurahOption key={surah.number} surah={surah} />}
      </PickerContent>
    </Picker>
  );
}
