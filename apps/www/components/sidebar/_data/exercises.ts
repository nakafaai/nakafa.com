import { getCategoryIcon } from "@repo/contents/_lib/exercises/category";

const data = [
  {
    title: "high-school",
    items: [
      {
        title: "tka",
        href: "/exercises/high-school/tka",
      },
      {
        title: "snbt",
        href: "/exercises/high-school/snbt",
      },
    ],
  },
] as const;

export const exercisesMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));
