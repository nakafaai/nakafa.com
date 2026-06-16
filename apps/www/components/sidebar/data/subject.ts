import { getCategoryIcon } from "@repo/contents/_lib/curriculum/icons";

const data = [
  {
    title: "middle-school",
    items: [
      {
        title: "grade",
        value: 7,
        href: "/curriculum/middle-school/7",
      },
      {
        title: "grade",
        value: 8,
        href: "/curriculum/middle-school/8",
      },
      {
        title: "grade",
        value: 9,
        href: "/curriculum/middle-school/9",
      },
    ],
  },
  {
    title: "high-school",
    items: [
      {
        title: "grade",
        value: 10,
        href: "/curriculum/high-school/10",
      },
      {
        title: "grade",
        value: 11,
        href: "/curriculum/high-school/11",
      },
      {
        title: "grade",
        value: 12,
        href: "/curriculum/high-school/12",
      },
    ],
  },
  {
    title: "university",
    items: [
      {
        title: "bachelor",
        href: "/curriculum/university/bachelor",
      },
    ],
  },
] as const;

export const subjectMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));
