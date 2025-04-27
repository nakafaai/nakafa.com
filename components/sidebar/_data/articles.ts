import { getCategoryIcon } from "@/lib/utils/articles/category";

export const articlesMenu = [
  {
    title: "politics",
    icon: getCategoryIcon("politics"),
    href: "/articles/politics",
  },
] as const;
