import {
  courseNode,
  defineCurriculum,
  frameworkNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";

export const unitedStatesCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.unitedStates,
  tree: [
    frameworkNode({
      children: [
        courseNode({
          children: [
            unitNode({
              key: "common-core-mathematics-number-quantity",
              order: 10,
              translations: {
                en: {
                  routeSlug: "number-and-quantity",
                  title: "Number and Quantity",
                },
                id: {
                  routeSlug: "bilangan-dan-kuantitas",
                  title: "Bilangan dan Kuantitas",
                },
              },
            }),
            unitNode({
              key: "common-core-mathematics-algebra",
              order: 20,
              translations: {
                en: {
                  routeSlug: "algebra",
                  title: "Algebra",
                },
                id: {
                  routeSlug: "aljabar",
                  title: "Aljabar",
                },
              },
            }),
            unitNode({
              key: "common-core-mathematics-functions",
              order: 30,
              translations: {
                en: {
                  routeSlug: "functions",
                  title: "Functions",
                },
                id: {
                  routeSlug: "fungsi",
                  title: "Fungsi",
                },
              },
            }),
            unitNode({
              key: "common-core-mathematics-geometry",
              order: 40,
              translations: {
                en: {
                  routeSlug: "geometry",
                  title: "Geometry",
                },
                id: {
                  routeSlug: "geometri",
                  title: "Geometri",
                },
              },
            }),
            unitNode({
              key: "common-core-mathematics-statistics-probability",
              order: 50,
              translations: {
                en: {
                  routeSlug: "statistics-and-probability",
                  title: "Statistics and Probability",
                },
                id: {
                  routeSlug: "statistika-dan-peluang",
                  title: "Statistika dan Peluang",
                },
              },
            }),
          ],
          iconKey: "mathematics",
          key: "common-core-mathematics",
          materialDomain: "mathematics",
          order: 10,
          translations: {
            en: {
              routeSlug: "common-core-mathematics",
              title: "Common Core Mathematics",
            },
            id: {
              routeSlug: "common-core-mathematics",
              title: "Common Core Mathematics",
            },
          },
        }),
        courseNode({
          iconKey: "course",
          key: "common-core-ela",
          order: 20,
          translations: {
            en: {
              routeSlug: "common-core-ela",
              title: "Common Core ELA",
            },
            id: {
              routeSlug: "common-core-ela",
              title: "Common Core ELA",
            },
          },
        }),
        courseNode({
          children: [
            unitNode({
              key: "ngss-physical-sciences",
              order: 10,
              translations: {
                en: {
                  routeSlug: "physical-sciences",
                  title: "Physical Sciences",
                },
                id: {
                  routeSlug: "ilmu-fisika",
                  title: "Ilmu Fisika",
                },
              },
            }),
            unitNode({
              key: "ngss-life-sciences",
              order: 20,
              translations: {
                en: {
                  routeSlug: "life-sciences",
                  title: "Life Sciences",
                },
                id: {
                  routeSlug: "ilmu-hayati",
                  title: "Ilmu Hayati",
                },
              },
            }),
            unitNode({
              key: "ngss-earth-space-sciences",
              order: 30,
              translations: {
                en: {
                  routeSlug: "earth-and-space-sciences",
                  title: "Earth and Space Sciences",
                },
                id: {
                  routeSlug: "ilmu-bumi-dan-antariksa",
                  title: "Ilmu Bumi dan Antariksa",
                },
              },
            }),
            unitNode({
              key: "ngss-engineering",
              order: 40,
              translations: {
                en: {
                  routeSlug: "engineering-technology-and-applications",
                  title: "Engineering, Technology, and Applications",
                },
                id: {
                  routeSlug: "rekayasa-teknologi-dan-aplikasi",
                  title: "Rekayasa, Teknologi, dan Aplikasi",
                },
              },
            }),
          ],
          iconKey: "science",
          key: "ngss-science",
          order: 30,
          translations: {
            en: {
              routeSlug: "ngss-science",
              title: "NGSS Science",
            },
            id: {
              routeSlug: "ngss-science",
              title: "NGSS Science",
            },
          },
        }),
      ],
      displayGroup: {
        en: { title: "Learning pathways" },
        id: { title: "Jalur belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "standards",
      key: "k-12-core-standards",
      order: 10,
      translations: {
        en: {
          routeSlug: "k-12-core-standards",
          title: "K-12 Core Standards",
        },
        id: {
          routeSlug: "standar-inti-k-12",
          title: "Standar Inti K-12",
        },
      },
    }),
    frameworkNode({
      displayGroup: {
        en: { title: "Learning pathways" },
        id: { title: "Jalur belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "state",
      key: "state-alignments",
      order: 20,
      translations: {
        en: {
          routeSlug: "state-alignments",
          title: "State Alignments",
        },
        id: {
          routeSlug: "penyelarasan-negara-bagian",
          title: "Penyelarasan Negara Bagian",
        },
      },
    }),
    frameworkNode({
      displayGroup: {
        en: { title: "Learning pathways" },
        id: { title: "Jalur belajar" },
      },
      displayGroupIconKey: "school",
      iconKey: "advanced",
      key: "advanced-high-school",
      order: 30,
      translations: {
        en: {
          routeSlug: "advanced-high-school",
          title: "Advanced High School / AP",
        },
        id: {
          routeSlug: "sma-lanjutan-ap",
          title: "SMA Lanjutan / AP",
        },
      },
    }),
  ],
});
