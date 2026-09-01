import { describe, expect, it } from "@effect/vitest";
import { BookOpen02Icon, EvilIcon } from "@hugeicons/core-free-icons";
import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { getArticleCategoryIcon } from "@/components/articles/category";

describe("article category presentation", () => {
  it("keeps the established icon and a safe future-category fallback", () => {
    expect(getArticleCategoryIcon(ArticleCategorySchema.make("politics"))).toBe(
      EvilIcon
    );
    expect(
      getArticleCategoryIcon(ArticleCategorySchema.make("technology"))
    ).toBe(BookOpen02Icon);
  });
});
