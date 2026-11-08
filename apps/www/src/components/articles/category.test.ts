import { describe, expect, it } from "@effect/vitest";
import { EvilIcon } from "@hugeicons/core-free-icons";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { Array as Arr } from "effect";
import { getArticleCategoryIcons } from "@/components/articles/category";

const POLITICS = ArticleCategorySchema.make("politics");
/** Categories that a content release brings in before the app knows them. */
const TECHNOLOGY = ArticleCategorySchema.make("technology");
const SCIENCE = ArticleCategorySchema.make("science");
/** On its own, this key points at the same spare icon as `TECHNOLOGY` does. */
const FOOD = ArticleCategorySchema.make("food");

describe("article category icons", () => {
  it("keeps the established icon of politics", () => {
    expect(getArticleCategoryIcons([{ category: POLITICS }])).toEqual([
      EvilIcon,
    ]);
  });

  it("gives a category that it does not know a spare icon from its key", () => {
    const [icon] = getArticleCategoryIcons([{ category: TECHNOLOGY }]);

    expect(Arr.contains(SPARE_ICONS, icon)).toBe(true);
    expect(getArticleCategoryIcons([{ category: TECHNOLOGY }])).toEqual([icon]);
  });

  it("separates two categories whose keys point at the same spare icon", () => {
    expect(getArticleCategoryIcons([{ category: FOOD }])).toEqual(
      getArticleCategoryIcons([{ category: TECHNOLOGY }])
    );

    const icons = getArticleCategoryIcons(
      Arr.map([POLITICS, TECHNOLOGY, FOOD, SCIENCE], (category) => ({
        category,
      }))
    );

    expect(icons).toHaveLength(4);
    expect(Arr.dedupe(icons)).toHaveLength(4);
    expect(icons[0]).toBe(EvilIcon);
  });
});
