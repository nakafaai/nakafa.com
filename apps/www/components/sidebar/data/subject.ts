import { getCategoryIcon } from "@repo/contents/_lib/curriculum/icons";
import type { Locale } from "next-intl";

const data = [
  {
    title: "high-school",
    items: [
      {
        title: "grade",
        value: 10,
        href: {
          en: "/curriculum/merdeka/class-10",
          id: "/kurikulum/merdeka/kelas-10",
        },
      },
      {
        title: "grade",
        value: 11,
        href: {
          en: "/curriculum/merdeka/class-11",
          id: "/kurikulum/merdeka/kelas-11",
        },
      },
      {
        title: "grade",
        value: 12,
        href: {
          en: "/curriculum/merdeka/class-12",
          id: "/kurikulum/merdeka/kelas-12",
        },
      },
    ],
  },
] as const;

export const subjectMenu = data.map((item) => ({
  ...item,
  icon: getCategoryIcon(item.title),
}));

export type SubjectMenuItem = (typeof subjectMenu)[number]["items"][number];

/**
 * Selects the localized public subject URL carried by the subject menu source
 * row.
 */
export function getSubjectMenuHref(item: SubjectMenuItem, locale: Locale) {
  return item.href[locale];
}
