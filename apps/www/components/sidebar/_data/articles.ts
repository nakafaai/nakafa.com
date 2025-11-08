import { getCategoryIcon } from "@repo/contents/_lib/articles/category";

const data = [
  {
    title: "politics",
    icon: getCategoryIcon("politics"),
    href: "/articles/politics",
  },
] as const;

export const articlesMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));
