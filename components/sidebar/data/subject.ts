import {
  BackpackIcon,
  LibraryIcon,
  NotebookIcon,
  UniversityIcon,
} from "lucide-react";

export const subjectMenu = [
  {
    title: "elementary-school",
    icon: BackpackIcon,
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
    title: "junior-high-school",
    icon: NotebookIcon,
    items: [
      {
        title: "grade",
        value: 7,
        href: "/subject/junior-high-school/7",
      },
      {
        title: "grade",
        value: 8,
        href: "/subject/junior-high-school/8",
      },
      {
        title: "grade",
        value: 9,
        href: "/subject/junior-high-school/9",
      },
    ],
  },
  {
    title: "senior-high-school",
    icon: LibraryIcon,
    items: [
      {
        title: "grade",
        value: 10,
        href: "/subject/senior-high-school/10",
      },
      {
        title: "grade",
        value: 11,
        href: "/subject/senior-high-school/11",
      },
      {
        title: "grade",
        value: 12,
        href: "/subject/senior-high-school/12",
      },
    ],
  },
  {
    title: "university",
    icon: UniversityIcon,
    items: [],
  },
] as const;
