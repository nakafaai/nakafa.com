import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";

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
