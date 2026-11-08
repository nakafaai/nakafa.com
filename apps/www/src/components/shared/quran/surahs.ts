import { createContext } from "react";
import type { QuranIndexSurah } from "@/lib/content/quran/search";

/**
 * The surahs of the Quran, in order, for a search that lists them: a surah page
 * provides them around its header, whose search reads them when it opens.
 */
export const QuranSurahsContext = createContext<
  readonly (typeof QuranIndexSurah.Type)[]
>([]);
