import { Search01Icon } from "@hugeicons/core-free-icons";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from "@repo/design-system/components/ui/autocomplete";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { use } from "react";
import { useTranslations } from "use-intl";
import { QuranSurahNumber } from "@/components/shared/quran/surah";
import { QuranSurahsContext } from "@/components/shared/quran/surahs";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { type QuranIndexSurah, searchSurahs } from "@/lib/content/quran/search";
import { TargetLink } from "@/lib/routing/link";
import { quranSurahTarget } from "@/lib/routing/target";

/** One surah a search keeps: its number, its two names and the meaning of its name, linked to the surah. */
function QuranSurahOption({ surah }: { surah: typeof QuranIndexSurah.Type }) {
  return (
    <AutocompleteItem
      className="gap-3"
      render={<TargetLink target={quranSurahTarget(surah.number)} />}
      value={surah}
    >
      <QuranSurahNumber number={surah.number} />
      <span className="flex min-w-0 flex-col">
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
    </AutocompleteItem>
  );
}

/** The surahs a search keeps, or the words that say none matched. */
function QuranSurahJumpList() {
  const t = useTranslations("Holy");

  return (
    <>
      <AutocompleteEmpty>{t("search-surah-none")}</AutocompleteEmpty>
      <AutocompleteList className="max-h-80">
        {(surah: typeof QuranIndexSurah.Type) => (
          <QuranSurahOption key={surah.number} surah={surah} />
        )}
      </AutocompleteList>
    </>
  );
}

/**
 * The search of a surah page's header: the surahs whose number, names or meaning
 * hold the words of the header's search, in a list under the box, the first one
 * highlighted. The arrows move through them, Enter opens one, and Escape closes
 * the list. `inline` draws the list in place, as a phone's search panel holds it.
 */
export function QuranSurahJump({
  autoFocus,
  inline = false,
}: {
  autoFocus: boolean;
  inline?: boolean;
}) {
  const t = useTranslations("Holy");
  const surahs = use(QuranSurahsContext);
  const search = useTableFilters((state) => state.search);
  const setSearch = useTableFilters((state) => state.setSearch);

  return (
    <Autocomplete
      autoHighlight
      filteredItems={searchSurahs(search, surahs)}
      inline={inline}
      items={surahs}
      itemToStringValue={(surah) => surah.title}
      onValueChange={setSearch}
      open={inline ? true : undefined}
      value={search}
    >
      <AutocompleteInput
        aria-label={t("search-surah")}
        autoFocus={autoFocus}
        placeholder={t("search-surah")}
        startAddon={<HugeIcons className="size-4" icon={Search01Icon} />}
      />
      {inline ? (
        <QuranSurahJumpList />
      ) : (
        <AutocompletePopup>
          <QuranSurahJumpList />
        </AutocompletePopup>
      )}
    </Autocomplete>
  );
}

/** A phone's surah search: the header's button, which opens the search in a panel under it. */
export function QuranSurahJumpButton() {
  const t = useTranslations("Holy");

  return (
    <Popover defaultOpen>
      <PopoverTrigger
        render={
          <Button
            aria-label={t("search-surah")}
            className="lg:hidden"
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        <HugeIcons icon={Search01Icon} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <QuranSurahJump autoFocus inline />
      </PopoverContent>
    </Popover>
  );
}
