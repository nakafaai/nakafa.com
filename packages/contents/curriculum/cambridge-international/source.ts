import {
  defineCurriculum,
  qualificationNode,
  stageNode,
} from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { igcseCourseNodes } from "@repo/contents/curriculum/cambridge-international/igcse/subjects";

export const cambridgeInternationalCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.cambridgeInternational,
  tree: [
    stageNode({
      displayGroup: {
        en: { title: "Learning stages" },
        id: { title: "Tahap belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "early-years",
      key: "early-years",
      order: 10,
      translations: {
        en: {
          routeSlug: "early-years",
          title: "Early Years",
        },
        id: {
          routeSlug: "early-years",
          title: "Early Years",
        },
      },
    }),
    stageNode({
      displayGroup: {
        en: { title: "Learning stages" },
        id: { title: "Tahap belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "primary-school",
      key: "primary",
      order: 20,
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
      displayGroup: {
        en: { title: "Learning stages" },
        id: { title: "Tahap belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "middle-school",
      key: "lower-secondary",
      order: 30,
      translations: {
        en: {
          routeSlug: "lower-secondary",
          title: "Lower Secondary",
        },
        id: {
          routeSlug: "lower-secondary",
          title: "Lower Secondary",
        },
      },
    }),
    stageNode({
      children: [
        qualificationNode({
          children: igcseCourseNodes,
          iconKey: "qualification",
          key: "igcse",
          order: 10,
          translations: {
            en: {
              routeSlug: "igcse",
              title: "Cambridge IGCSE",
            },
            id: {
              routeSlug: "igcse",
              title: "Cambridge IGCSE",
            },
          },
        }),
        qualificationNode({
          iconKey: "certificate",
          key: "o-level",
          order: 20,
          translations: {
            en: {
              routeSlug: "o-level",
              title: "Cambridge O Level",
            },
            id: {
              routeSlug: "o-level",
              title: "Cambridge O Level",
            },
          },
        }),
        qualificationNode({
          iconKey: "diploma",
          key: "ice",
          order: 30,
          translations: {
            en: {
              routeSlug: "ice",
              title: "Cambridge ICE",
            },
            id: {
              routeSlug: "ice",
              title: "Cambridge ICE",
            },
          },
        }),
      ],
      displayGroup: {
        en: { title: "Learning stages" },
        id: { title: "Tahap belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "high-school",
      key: "upper-secondary",
      order: 40,
      translations: {
        en: {
          routeSlug: "upper-secondary",
          title: "Upper Secondary",
        },
        id: {
          routeSlug: "upper-secondary",
          title: "Upper Secondary",
        },
      },
    }),
    stageNode({
      children: [
        qualificationNode({
          iconKey: "course",
          key: "as-a-level",
          order: 10,
          translations: {
            en: {
              routeSlug: "as-a-level",
              title: "International AS & A Level",
            },
            id: {
              routeSlug: "as-a-level",
              title: "International AS & A Level",
            },
          },
        }),
        qualificationNode({
          iconKey: "diploma",
          key: "aice",
          order: 20,
          translations: {
            en: {
              routeSlug: "aice",
              title: "Cambridge AICE Diploma",
            },
            id: {
              routeSlug: "aice",
              title: "Cambridge AICE Diploma",
            },
          },
        }),
        qualificationNode({
          iconKey: "certificate",
          key: "ipq",
          order: 30,
          translations: {
            en: {
              routeSlug: "ipq",
              title: "Cambridge IPQ",
            },
            id: {
              routeSlug: "ipq",
              title: "Cambridge IPQ",
            },
          },
        }),
      ],
      displayGroup: {
        en: { title: "Learning stages" },
        id: { title: "Tahap belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "advanced",
      key: "advanced",
      order: 50,
      translations: {
        en: {
          routeSlug: "advanced",
          title: "Advanced",
        },
        id: {
          routeSlug: "advanced",
          title: "Advanced",
        },
      },
    }),
  ],
});
