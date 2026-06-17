import {
  defineCurriculum,
  stageNode,
} from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";

export const singaporeMoeCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.singaporeMoe,
  tree: [
    stageNode({
      displayGroup: {
        en: { title: "Singapore MOE" },
        id: { title: "Singapore MOE" },
      },
      displayGroupIconKey: "school",
      iconKey: "primary-school",
      key: "primary",
      order: 10,
      translations: {
        en: {
          description:
            "Build foundational learning across Singapore Primary subjects.",
          routeSlug: "primary",
          title: "Primary",
        },
        id: {
          description:
            "Bangun fondasi belajar lintas mata pelajaran Primary Singapura.",
          routeSlug: "primary",
          title: "Primary",
        },
      },
    }),
    stageNode({
      displayGroup: {
        en: { title: "Singapore MOE" },
        id: { title: "Singapore MOE" },
      },
      displayGroupIconKey: "school",
      iconKey: "middle-school",
      key: "secondary",
      order: 20,
      translations: {
        en: {
          description:
            "Continue into Singapore Secondary subjects and pathways.",
          routeSlug: "secondary",
          title: "Secondary",
        },
        id: {
          description:
            "Lanjutkan ke mata pelajaran dan jalur Secondary Singapura.",
          routeSlug: "secondary",
          title: "Secondary",
        },
      },
    }),
    stageNode({
      displayGroup: {
        en: { title: "Singapore MOE" },
        id: { title: "Singapore MOE" },
      },
      displayGroupIconKey: "school",
      iconKey: "advanced",
      key: "pre-university",
      order: 30,
      translations: {
        en: {
          description:
            "Prepare for Singapore Pre-university learning and A-Level subjects.",
          routeSlug: "pre-university",
          title: "Pre-university",
        },
        id: {
          description:
            "Siapkan pembelajaran Pre-university Singapura dan mata pelajaran A-Level.",
          routeSlug: "pre-university",
          title: "Pre-university",
        },
      },
    }),
  ],
});
