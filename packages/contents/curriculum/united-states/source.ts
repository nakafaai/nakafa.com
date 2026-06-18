import {
  defineCurriculum,
  stageNode,
} from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { usHighSchoolMathematicsCourseNode } from "@repo/contents/curriculum/united-states/mathematics";
import { usHighSchoolScienceCourseNode } from "@repo/contents/curriculum/united-states/science";

export const unitedStatesCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.unitedStates,
  tree: [
    stageNode({
      children: [
        usHighSchoolMathematicsCourseNode,
        usHighSchoolScienceCourseNode,
      ],
      displayGroup: {
        en: { title: "School stages" },
        id: { title: "Tahap sekolah" },
      },
      displayGroupIconKey: "school",
      iconKey: "high-school",
      key: "high-school",
      order: 10,
      translations: {
        en: {
          routeSlug: "high-school",
          title: "High School",
        },
        id: {
          routeSlug: "sma",
          title: "SMA",
        },
      },
    }),
  ],
});
