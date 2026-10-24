import type { Locale } from "@repo/internationalization/src/locale";
import { PATHNAMES } from "@repo/internationalization/src/pathnames";
import { Array as Arr } from "effect";
import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";
import type { LinkTarget } from "@/lib/routing/link";
import { curriculumTarget } from "@/lib/routing/target";

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
        curriculum: "merdeka",
        path: {
          de: ["klasse-10"],
          en: ["class-10"],
          id: ["kelas-10"],
        },
      },
      {
        title: "grade",
        value: 11,
        icon: CURRICULUM_NAVIGATION_ICONS["grade-11"],
        curriculum: "merdeka",
        path: {
          de: ["klasse-11"],
          en: ["class-11"],
          id: ["kelas-11"],
        },
      },
      {
        title: "grade",
        value: 12,
        icon: CURRICULUM_NAVIGATION_ICONS["grade-12"],
        curriculum: "merdeka",
        path: {
          de: ["klasse-12"],
          en: ["class-12"],
          id: ["kelas-12"],
        },
      },
    ],
  },
] as const;

type SubjectMenuItem = (typeof subjectMenu)[number]["items"][number];

/**
 * The localized public URL of a subject menu row, such as
 * `/curriculum/merdeka/class-11`. The route map spells the curriculum segment,
 * and the row spells its program and page in each locale.
 */
export function getSubjectMenuHref(item: SubjectMenuItem, locale: Locale) {
  const curriculum = PATHNAMES["/curricula"][locale];
  return `${curriculum}/${item.curriculum}/${Arr.join(item.path[locale], "/")}`;
}

/** The typed link target of a subject menu row on one locale. */
export function getSubjectMenuTarget(
  item: SubjectMenuItem,
  locale: Locale
): LinkTarget {
  return curriculumTarget({
    curriculum: item.curriculum,
    path: item.path[locale],
  });
}
