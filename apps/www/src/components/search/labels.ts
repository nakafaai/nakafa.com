import { useTranslations } from "use-intl";
import type { ContentSearchResultItem } from "@/lib/search/answer";

/** Resolves the localized label of each search result section. */
export function useSearchSectionLabels(): Record<
  ContentSearchResultItem["section"],
  string
> {
  const tCommon = useTranslations("Common");
  const tArticles = useTranslations("Articles");
  const tHoly = useTranslations("Holy");

  return {
    articles: tArticles("articles"),
    material: tCommon("material"),
    quran: tHoly("quran"),
    tryout: tCommon("try-out"),
  };
}
