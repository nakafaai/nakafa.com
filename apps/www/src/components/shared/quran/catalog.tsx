import { Card } from "@repo/design-system/components/ui/card";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { QuranSurahName } from "@/components/shared/quran/name";
import {
  QuranSurahNumber,
  QuranSurahRow,
} from "@/components/shared/quran/surah";
import { TableEmpty } from "@/components/shared/table/frame";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { type QuranIndexSurah, searchSurahs } from "@/lib/content/quran/search";
import { quranSurahTarget } from "@/lib/routing/target";

/**
 * The surahs of the Quran in one card, as many as the header's search keeps, each
 * with its number, its two names and the meaning of its name. The search runs in
 * the browser over the whole list, so typing asks the server nothing.
 */
export function QuranSurahCatalog({
  surahs,
}: {
  surahs: readonly (typeof QuranIndexSurah.Type)[];
}) {
  const t = useTranslations("Holy");
  const search = useTableFilters((state) => state.search);
  const kept = searchSurahs(search, surahs);

  if (Arr.isReadonlyArrayEmpty(kept)) {
    return (
      <TableEmpty
        act="searching"
        description={t("search-surah-none-description")}
        title={t("search-surah-none")}
      />
    );
  }

  return (
    <Card className="py-0">
      <CardLinks>
        {Arr.map(kept, (surah) => (
          <CardLink
            key={surah.number}
            target={quranSurahTarget(surah.number)}
            title={surah.title}
          >
            <QuranSurahRow
              meaning={surah.meaning}
              ring={<QuranSurahNumber number={surah.number} />}
            >
              <QuranSurahName arabic={surah.arabic} title={surah.title} />
            </QuranSurahRow>
          </CardLink>
        ))}
      </CardLinks>
    </Card>
  );
}
