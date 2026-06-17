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
              description:
                "Follow Common Core mathematics domains from quantity through statistics.",
              routeSlug: "common-core-mathematics",
              title: "Common Core Mathematics",
            },
            id: {
              description:
                "Ikuti domain matematika Common Core dari kuantitas hingga statistika.",
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
              description:
                "Organize English language arts standards for reading, writing, speaking, and language.",
              routeSlug: "common-core-ela",
              title: "Common Core ELA",
            },
            id: {
              description:
                "Susun standar bahasa Inggris untuk membaca, menulis, berbicara, dan bahasa.",
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
              description:
                "Connect NGSS science domains across physical, life, earth, and engineering ideas.",
              routeSlug: "ngss-science",
              title: "NGSS Science",
            },
            id: {
              description:
                "Hubungkan domain sains NGSS melalui fisika, hayati, bumi, dan rekayasa.",
              routeSlug: "ngss-science",
              title: "NGSS Science",
            },
          },
        }),
      ],
      displayGroup: {
        en: { title: "United States Pathways" },
        id: { title: "Jalur Amerika Serikat" },
      },
      displayGroupIconKey: "standards",
      iconKey: "standards",
      key: "k-12-core-standards",
      order: 10,
      translations: {
        en: {
          description:
            "Group K-12 Common Core and NGSS standards into subject pathways.",
          routeSlug: "k-12-core-standards",
          title: "K-12 Core Standards",
        },
        id: {
          description:
            "Kelompokkan Common Core dan NGSS K-12 menjadi jalur mata pelajaran.",
          routeSlug: "standar-inti-k-12",
          title: "Standar Inti K-12",
        },
      },
    }),
    frameworkNode({
      displayGroup: {
        en: { title: "United States Pathways" },
        id: { title: "Jalur Amerika Serikat" },
      },
      displayGroupIconKey: "standards",
      iconKey: "state",
      key: "state-alignments",
      order: 20,
      translations: {
        en: {
          description:
            "Compare state-specific pathways as their standards are added.",
          routeSlug: "state-alignments",
          title: "State Alignments",
        },
        id: {
          description:
            "Bandingkan jalur negara bagian saat standarnya ditambahkan.",
          routeSlug: "penyelarasan-negara-bagian",
          title: "Penyelarasan Negara Bagian",
        },
      },
    }),
    frameworkNode({
      displayGroup: {
        en: { title: "United States Pathways" },
        id: { title: "Jalur Amerika Serikat" },
      },
      displayGroupIconKey: "standards",
      iconKey: "advanced",
      key: "advanced-high-school",
      order: 30,
      translations: {
        en: {
          description:
            "Prepare advanced high school and AP pathways as they become available.",
          routeSlug: "advanced-high-school",
          title: "Advanced High School / AP",
        },
        id: {
          description: "Siapkan jalur SMA lanjutan dan AP saat tersedia.",
          routeSlug: "sma-lanjutan-ap",
          title: "SMA Lanjutan / AP",
        },
      },
    }),
  ],
});
