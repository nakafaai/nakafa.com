import {
  defineCurriculum,
  stageNode,
} from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import {
  singaporeSecondaryAdditionalMathematicsCourseNode,
  singaporeSecondaryMathematicsCourseNode,
} from "@repo/contents/curriculum/singapore-moe/mathematics";
import { singaporeSecondaryScienceCourseNode } from "@repo/contents/curriculum/singapore-moe/science";

export const singaporeMoeCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.singaporeMoe,
  tree: [
    stageNode({
      displayGroup: {
        en: { title: "School stages" },
        id: { title: "Tahap sekolah" },
      },
      displayGroupIconKey: "school",
      iconKey: "primary-school",
      key: "primary",
      order: 10,
      translations: {
        en: {
          routeSlug: "primary",
          title: "Primary",
        },
        id: {
          routeSlug: "primary",
          title: "Primary",
        },
      },
    }),
    stageNode({
      children: [
        singaporeSecondaryMathematicsCourseNode,
        singaporeSecondaryAdditionalMathematicsCourseNode,
        singaporeSecondaryScienceCourseNode,
      ],
      displayGroup: {
        en: { title: "School stages" },
        id: { title: "Tahap sekolah" },
      },
      displayGroupIconKey: "school",
      iconKey: "middle-school",
      key: "secondary",
      order: 20,
      translations: {
        en: {
          routeSlug: "secondary",
          title: "Secondary",
        },
        id: {
          routeSlug: "secondary",
          title: "Secondary",
        },
      },
    }),
    stageNode({
      displayGroup: {
        en: { title: "School stages" },
        id: { title: "Tahap sekolah" },
      },
      displayGroupIconKey: "school",
      iconKey: "advanced",
      key: "pre-university",
      order: 30,
      translations: {
        en: {
          routeSlug: "pre-university",
          title: "Pre-university",
        },
        id: {
          routeSlug: "pre-university",
          title: "Pre-university",
        },
      },
    }),
  ],
});
