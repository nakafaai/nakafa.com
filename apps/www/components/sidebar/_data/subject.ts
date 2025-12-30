import { getCategoryIcon } from "@repo/contents/_lib/subject/category";

const data = [
  {
    title: "middle-school",
    items: [
      {
        title: "grade",
        value: 7,
        href: "/subject/middle-school/7",
      },
      {
        title: "grade",
        value: 8,
        href: "/subject/middle-school/8",
      },
      {
        title: "grade",
        value: 9,
        href: "/subject/middle-school/9",
      },
    ],
  },
  {
    title: "high-school",
    items: [
      {
        title: "grade",
        value: 10,
        href: "/subject/high-school/10",
      },
      {
        title: "grade",
        value: 11,
        href: "/subject/high-school/11",
      },
      {
        title: "grade",
        value: 12,
        href: "/subject/high-school/12",
      },
    ],
  },
  {
    title: "university",
    items: [
      {
        title: "bachelor",
        href: "/subject/university/bachelor",
      },
    ],
  },
] as const;

export const subjectMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));
