import { getCategoryIcon } from "@repo/contents/_lib/assessment/icons";

const data = [
  {
    title: "middle-school",
    items: [
      {
        title: "grade-9",
        href: "/assessment/middle-school/grade-9",
      },
    ],
  },
  {
    title: "high-school",
    items: [
      {
        title: "tka",
        href: "/assessment/high-school/tka",
      },
      {
        title: "snbt",
        href: "/assessment/high-school/snbt",
      },
    ],
  },
] as const;

export const exercisesMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));
