import { getCategoryIcon } from "@repo/contents/_lib/exercises/category";

export const exercisesMenu = [
  {
    title: "high-school",
    icon: getCategoryIcon("high-school"),
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
