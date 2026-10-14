import { describe, expect, it } from "@effect/vitest";
import { EvilIcon } from "@hugeicons/core-free-icons";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { Array as Arr } from "effect";
import {
  getArticleCategoryIcon,
  getArticleCategoryIcons,
} from "@/components/articles/category";

const POLITICS = ArticleCategorySchema.make("politics");
/** Categories that a content release brings in before the app knows them. */
const TECHNOLOGY = ArticleCategorySchema.make("technology");
const SCIENCE = ArticleCategorySchema.make("science");
/** On its own, this key points at the same spare icon as `TECHNOLOGY` does. */
const FOOD = ArticleCategorySchema.make("food");

describe("article category icons", () => {
  it("keeps the established icon of politics, alone and in a list", () => {
    expect(getArticleCategoryIcon(POLITICS)).toBe(EvilIcon);
    expect(getArticleCategoryIcons([{ category: POLITICS }])).toEqual([
      EvilIcon,
    ]);
  });

  it("gives a category that it does not know a spare icon from its key", () => {
    const icon = getArticleCategoryIcon(TECHNOLOGY);

    expect(Arr.contains(SPARE_ICONS, icon)).toBe(true);
    expect(getArticleCategoryIcon(TECHNOLOGY)).toBe(icon);
    expect(getArticleCategoryIcon(SCIENCE)).not.toBe(icon);
  });

  it("separates two categories whose keys point at the same spare icon", () => {
    expect(getArticleCategoryIcon(FOOD)).toBe(
      getArticleCategoryIcon(TECHNOLOGY)
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
