import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { getArticleCategoryIcon } from "@/components/articles/category";

export const articlesMenu = [
  {
    title: "politics",
    icon: getArticleCategoryIcon(ArticleCategorySchema.make("politics")),
    href: "/articles/politics",
  },
] as const;
