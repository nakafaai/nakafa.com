import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";
import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";

const curriculaPath = routing.pathnames["/curricula"];

/**
 * The high school grades of the subject menu. Each grade draws the icon of its
 * own navigation key, so the rows of one group never share the icon of the group.
 */
export const subjectMenu = [
  {
    title: "high-school",
    items: [
      {
        title: "grade",
        value: 10,
        icon: CURRICULUM_NAVIGATION_ICONS["grade-10"],
        href: {
          de: `${curriculaPath.de}/merdeka/klasse-10`,
          en: `${curriculaPath.en}/merdeka/class-10`,
          id: `${curriculaPath.id}/merdeka/kelas-10`,
        },
      },
      {
        title: "grade",
        value: 11,
        icon: CURRICULUM_NAVIGATION_ICONS["grade-11"],
        href: {
          de: `${curriculaPath.de}/merdeka/klasse-11`,
          en: `${curriculaPath.en}/merdeka/class-11`,
          id: `${curriculaPath.id}/merdeka/kelas-11`,
        },
      },
      {
        title: "grade",
        value: 12,
        icon: CURRICULUM_NAVIGATION_ICONS["grade-12"],
        href: {
          de: `${curriculaPath.de}/merdeka/klasse-12`,
          en: `${curriculaPath.en}/merdeka/class-12`,
          id: `${curriculaPath.id}/merdeka/kelas-12`,
        },
      },
    ],
  },
] as const;

type SubjectMenuItem = (typeof subjectMenu)[number]["items"][number];

/**
 * Selects the localized public subject URL carried by the subject menu source
 * row.
 */
export function getSubjectMenuHref(item: SubjectMenuItem, locale: Locale) {
  return item.href[locale];
}
