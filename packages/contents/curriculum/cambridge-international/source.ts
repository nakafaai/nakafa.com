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
        en: { title: "Cambridge Pathway" },
        id: { title: "Cambridge Pathway" },
      },
      displayGroupIconKey: "global-education",
      iconKey: "early-years",
      key: "early-years",
      order: 10,
      translations: {
        en: {
          description:
            "Begin the Cambridge Pathway with early foundations for ages 3 to 6.",
          routeSlug: "early-years",
          title: "Early Years",
        },
        id: {
          description:
            "Mulai Cambridge Pathway dengan fondasi awal untuk usia 3 hingga 6 tahun.",
          routeSlug: "early-years",
          title: "Early Years",
        },
      },
    }),
    stageNode({
      displayGroup: {
        en: { title: "Cambridge Pathway" },
        id: { title: "Cambridge Pathway" },
      },
      displayGroupIconKey: "global-education",
      iconKey: "primary-school",
      key: "primary",
      order: 20,
      translations: {
        en: {
          description:
            "Build primary-stage knowledge and skills across Cambridge subjects.",
          routeSlug: "primary",
          title: "Primary",
        },
        id: {
          description:
            "Bangun pengetahuan dan keterampilan jenjang Primary dalam mata pelajaran Cambridge.",
          routeSlug: "primary",
          title: "Primary",
        },
      },
    }),
    stageNode({
      displayGroup: {
        en: { title: "Cambridge Pathway" },
        id: { title: "Cambridge Pathway" },
      },
      displayGroupIconKey: "global-education",
      iconKey: "middle-school",
      key: "lower-secondary",
      order: 30,
      translations: {
        en: {
          description:
            "Strengthen Lower Secondary subject foundations before qualification pathways.",
          routeSlug: "lower-secondary",
          title: "Lower Secondary",
        },
        id: {
          description:
            "Perkuat fondasi mata pelajaran Lower Secondary sebelum jalur kualifikasi.",
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
              description:
                "Study Cambridge IGCSE courses through focused subject sequences.",
              routeSlug: "igcse",
              title: "Cambridge IGCSE",
            },
            id: {
              description:
                "Pelajari kursus Cambridge IGCSE melalui urutan mata pelajaran yang terarah.",
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
              description:
                "Prepare for Cambridge O Level subject qualifications.",
              routeSlug: "o-level",
              title: "Cambridge O Level",
            },
            id: {
              description:
                "Siapkan kualifikasi mata pelajaran Cambridge O Level.",
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
              description:
                "Explore the Cambridge ICE group award across IGCSE subjects.",
              routeSlug: "ice",
              title: "Cambridge ICE",
            },
            id: {
              description:
                "Jelajahi penghargaan Cambridge ICE lintas mata pelajaran IGCSE.",
              routeSlug: "ice",
              title: "Cambridge ICE",
            },
          },
        }),
      ],
      displayGroup: {
        en: { title: "Cambridge Pathway" },
        id: { title: "Cambridge Pathway" },
      },
      displayGroupIconKey: "global-education",
      iconKey: "high-school",
      key: "upper-secondary",
      order: 40,
      translations: {
        en: {
          description:
            "Choose Upper Secondary qualifications such as IGCSE, O Level, and ICE.",
          routeSlug: "upper-secondary",
          title: "Upper Secondary",
        },
        id: {
          description:
            "Pilih kualifikasi Upper Secondary seperti IGCSE, O Level, dan ICE.",
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
              description:
                "Continue into Cambridge International AS & A Level subjects.",
              routeSlug: "as-a-level",
              title: "International AS & A Level",
            },
            id: {
              description:
                "Lanjutkan ke mata pelajaran Cambridge International AS & A Level.",
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
              description:
                "Explore the Cambridge AICE Diploma pathway across advanced subjects.",
              routeSlug: "aice",
              title: "Cambridge AICE Diploma",
            },
            id: {
              description:
                "Jelajahi jalur Cambridge AICE Diploma lintas mata pelajaran lanjutan.",
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
              description:
                "Develop independent research through the Cambridge IPQ route.",
              routeSlug: "ipq",
              title: "Cambridge IPQ",
            },
            id: {
              description:
                "Kembangkan riset mandiri melalui jalur Cambridge IPQ.",
              routeSlug: "ipq",
              title: "Cambridge IPQ",
            },
          },
        }),
      ],
      displayGroup: {
        en: { title: "Cambridge Pathway" },
        id: { title: "Cambridge Pathway" },
      },
      displayGroupIconKey: "global-education",
      iconKey: "advanced",
      key: "advanced",
      order: 50,
      translations: {
        en: {
          description:
            "Move into advanced Cambridge qualifications after Upper Secondary.",
          routeSlug: "advanced",
          title: "Advanced",
        },
        id: {
          description:
            "Lanjutkan ke kualifikasi Cambridge lanjutan setelah Upper Secondary.",
          routeSlug: "advanced",
          title: "Advanced",
        },
      },
    }),
  ],
});
