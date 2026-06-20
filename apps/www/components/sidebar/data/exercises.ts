import { getCategoryIcon } from "@repo/contents/_lib/assessment/icons";
import type { Locale } from "next-intl";

const data = [
  {
    title: "high-school",
    items: [
      {
        title: "snbt",
        href: {
          en: "/practice/snbt",
          id: "/latihan/snbt",
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

/**
 * Selects the localized public practice URL carried by the exercises menu
 * source row.
 */
export function getExercisesMenuHref(item: ExercisesMenuItem, locale: Locale) {
  if (locale === "id") {
    return item.href.id;
  }

  return item.href.en;
}
