import {
  BackpackIcon,
  BookIcon,
  NotebookIcon,
  PresentationIcon,
  UniversityIcon,
} from "lucide-react";

export const studyMenu = [
  {
    title: "elementary-school",
    icon: BackpackIcon,
    items: [],
  },
  {
    title: "junior-high-school",
    icon: BookIcon,
    items: [],
  },
  {
    title: "senior-high-school",
    icon: NotebookIcon,
    items: [
      {
        title: "grade",
        value: 10,
        href: "/study/high-school/10",
      },
      {
        title: "grade",
        value: 11,
        href: "/study/high-school/11",
      },
      {
        title: "grade",
        value: 12,
        href: "/study/high-school/12",
      },
    ],
  },
  {
    title: "vocational-school",
    icon: PresentationIcon,
    items: [],
  },
  {
    title: "university",
    icon: UniversityIcon,
    items: [],
  },
] as const;
