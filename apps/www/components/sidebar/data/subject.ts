import { getCategoryIcon } from "@repo/contents/curriculum/icons";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr } from "effect";
import type { Locale } from "next-intl";

const curriculaPath = routing.pathnames["/curricula"];

const data = [
  {
    title: "high-school",
    items: [
      {
        title: "grade",
        value: 10,
        href: {
          de: `${curriculaPath.de}/merdeka/klasse-10`,
          en: `${curriculaPath.en}/merdeka/class-10`,
          id: `${curriculaPath.id}/merdeka/kelas-10`,
        },
      },
      {
        title: "grade",
        value: 11,
        href: {
          de: `${curriculaPath.de}/merdeka/klasse-11`,
          en: `${curriculaPath.en}/merdeka/class-11`,
          id: `${curriculaPath.id}/merdeka/kelas-11`,
        },
      },
      {
        title: "grade",
        value: 12,
        href: {
          de: `${curriculaPath.de}/merdeka/klasse-12`,
          en: `${curriculaPath.en}/merdeka/class-12`,
          id: `${curriculaPath.id}/merdeka/kelas-12`,
        },
      },
    ],
  },
] as const;

export const subjectMenu = Arr.map(data, (item) => ({
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
