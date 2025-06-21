import { getCategoryIcon } from "@repo/contents/_lib/subject/category";

export const subjectAll = [
  {
    title: "high-school",
    icon: getCategoryIcon("high-school"),
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
] as const;
