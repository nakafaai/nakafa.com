import { getCategoryIcon } from "@repo/contents/_lib/articles/category";

export const articlesMenu = [
  {
    title: "politics",
    icon: getCategoryIcon("politics"),
    href: "/articles/politics",
  },
] as const;
