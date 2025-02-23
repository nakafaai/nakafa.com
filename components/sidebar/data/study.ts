import {
  BackpackIcon,
  BookIcon,
  NotebookIcon,
  UniversityIcon,
} from "lucide-react";

export const studyMenu = [
  {
    title: "elementary-school",
    icon: BackpackIcon,
    items: [
      {
        title: "grade",
        value: 1,
        href: "/study/elementary-school/1",
      },
      {
        title: "grade",
        value: 2,
        href: "/study/elementary-school/2",
      },
      {
        title: "grade",
        value: 3,
        href: "/study/elementary-school/3",
      },
      {
        title: "grade",
        value: 4,
        href: "/study/elementary-school/4",
      },
      {
        title: "grade",
        value: 5,
        href: "/study/elementary-school/5",
      },
      {
        title: "grade",
        value: 6,
        href: "/study/elementary-school/6",
      },
    ],
  },
  {
    title: "junior-high-school",
    icon: BookIcon,
    items: [
      {
        title: "grade",
        value: 7,
        href: "/study/junior-high-school/7",
      },
      {
        title: "grade",
        value: 8,
        href: "/study/junior-high-school/8",
      },
      {
        title: "grade",
        value: 9,
        href: "/study/junior-high-school/9",
      },
    ],
  },
  {
    title: "senior-high-school",
    icon: NotebookIcon,
    items: [
      {
        title: "grade",
        value: 10,
        href: "/study/senior-high-school/10",
      },
      {
        title: "grade",
        value: 11,
        href: "/study/senior-high-school/11",
      },
      {
        title: "grade",
        value: 12,
        href: "/study/high-school/12",
      },
    ],
  },
  {
    title: "university",
    icon: UniversityIcon,
    items: [],
  },
] as const;
