import { getCategoryIcon } from "@/lib/utils/subject/category";

export const subjectAll = [
  {
    title: "elementary-school",
    icon: getCategoryIcon("elementary-school"),
    items: [
      {
        title: "grade",
        value: 1,
        href: "/subject/elementary-school/1",
      },
      {
        title: "grade",
        value: 2,
        href: "/subject/elementary-school/2",
      },
      {
        title: "grade",
        value: 3,
        href: "/subject/elementary-school/3",
      },
      {
        title: "grade",
        value: 4,
        href: "/subject/elementary-school/4",
      },
      {
        title: "grade",
        value: 5,
        href: "/subject/elementary-school/5",
      },
      {
        title: "grade",
        value: 6,
        href: "/subject/elementary-school/6",
      },
    ],
  },
  {
    title: "middle-school",
    icon: getCategoryIcon("middle-school"),
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
  {
    title: "university",
    icon: getCategoryIcon("university"),
    items: [
      {
        title: "bachelor",
        href: "/subject/university/bachelor",
      },
    ],
  },
] as const;

export const subjectSchool = subjectAll.filter(
  (item) => item.title !== "university"
);

export const subjectUniversity = subjectAll.filter(
  (item) => item.title === "university"
);
