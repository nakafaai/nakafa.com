import { getCategoryIcon } from "@repo/contents/_lib/assessment/icons";
import type { Locale } from "next-intl";

const data = [
  {
    title: "high-school",
    items: [
      {
        title: "snbt",
        href: {
          en: "/exams/snbt",
          id: "/ujian/snbt",
        },
      },
    ],
  },
] as const;

export const exercisesMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));

export type ExercisesMenuItem = (typeof exercisesMenu)[number]["items"][number];

export function getExercisesMenuHref(item: ExercisesMenuItem, locale: Locale) {
  if (locale === "id") {
    return item.href.id;
  }

  return item.href.en;
}
