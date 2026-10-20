import { EvilIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ArticleCategory } from "@nakafa/aksara-contracts/projection/article";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { getTileIcon, getTileLooks } from "@repo/design-system/lib/look";
import { Array as Arr, Option, Record as Rec, Tuple } from "effect";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/** The article categories that the app knows, each with an icon of its own. */
export const ARTICLE_CATEGORY_ICONS: Readonly<Record<string, IconSvgElement>> =
  { politics: EvilIcon };

/**
 * The icons that one category may show: its own, or the spare icons for a
 * category that a content release brings in before the app knows it, so it
 * never borrows the icon of another category.
 */
function readCategoryIcons(
  category: ArticleCategory
): Arr.NonEmptyReadonlyArray<IconSvgElement> {
  return Option.match(Rec.get(ARTICLE_CATEGORY_ICONS, category), {
    onNone: () => SPARE_ICONS,
    onSome: Arr.of,
  });
}

/**
 * The icon of each category of one list, in the same order, so that no two
 * categories of the list share an icon.
 *
 * @param items - The rows of one list, each with its category
 * @returns One icon per row
 */
export function getArticleCategoryIcons(
  items: readonly Pick<ArticleNavigationItem, "category">[]
) {
  return Arr.map(
    getTileLooks(
      Arr.map(items, ({ category }) =>
        Tuple.make(readCategoryIcons(category), category)
      )
    ),
    ({ icon }) => icon
  );
}

/** The icon of one category on its own, such as the header of its page. */
export function getArticleCategoryIcon(category: ArticleCategory) {
  return getTileIcon(readCategoryIcons(category), category);
}
