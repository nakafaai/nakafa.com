import { courseNode, unitNode } from "@repo/contents/_types/curriculum/schema";

export const commonCoreNgssStandardNodes = [
  courseNode({
    key: "high-school-mathematics",
    order: 10,
    translations: {
      en: {
        title: "High School Mathematics",
        description:
          "Study high school math through functions, geometry, and statistics.",
      },
      id: {
        title: "High School Mathematics",
        description:
          "Pelajari matematika SMA melalui fungsi, geometri, dan statistika.",
      },
    },
    children: [
      unitNode({
        key: "high-school-mathematics-number-quantity",
        order: 10,
        translations: {
          en: {
            title: "Number and Quantity",
          },
          id: {
            title: "Bilangan dan Kuantitas",
          },
        },
      }),
      unitNode({
        key: "high-school-mathematics-algebra",
        order: 20,
        translations: {
          en: {
            title: "Algebra",
          },
          id: {
            title: "Aljabar",
          },
        },
      }),
      unitNode({
        key: "high-school-mathematics-functions",
        order: 30,
        translations: {
          en: {
            title: "Functions",
          },
          id: {
            title: "Fungsi",
          },
        },
      }),
      unitNode({
        key: "high-school-mathematics-modeling",
        order: 40,
        translations: {
          en: {
            title: "Modeling",
          },
          id: {
            title: "Pemodelan",
          },
        },
      }),
      unitNode({
        key: "high-school-mathematics-geometry",
        order: 50,
        translations: {
          en: {
            title: "Geometry",
          },
          id: {
            title: "Geometri",
          },
        },
      }),
      unitNode({
        key: "high-school-mathematics-statistics-probability",
        order: 60,
        translations: {
          en: {
            title: "Statistics and Probability",
          },
          id: {
            title: "Statistika dan Peluang",
          },
        },
      }),
    ],
  }),
  courseNode({
    key: "high-school-science",
    order: 20,
    translations: {
      en: {
        title: "High School Science",
        description:
          "Explore physical science, life science, earth science, and engineering ideas.",
      },
      id: {
        title: "High School Science",
        description: "Jelajahi fisika, biologi, bumi antariksa, dan rekayasa.",
      },
    },
    children: [
      unitNode({
        key: "high-school-science-physical-sciences",
        order: 10,
        translations: {
          en: {
            title: "Physical Sciences",
          },
          id: {
            title: "Ilmu Fisika",
          },
        },
      }),
      unitNode({
        key: "high-school-science-life-sciences",
        order: 20,
        translations: {
          en: {
            title: "Life Sciences",
          },
          id: {
            title: "Ilmu Hayati",
          },
        },
      }),
      unitNode({
        key: "high-school-science-earth-space-sciences",
        order: 30,
        translations: {
          en: {
            title: "Earth and Space Sciences",
          },
          id: {
            title: "Ilmu Bumi dan Antariksa",
          },
        },
      }),
      unitNode({
        key: "high-school-science-engineering",
        order: 40,
        translations: {
          en: {
            title: "Engineering, Technology, and Applications",
          },
          id: {
            title: "Rekayasa, Teknologi, dan Aplikasi",
          },
        },
      }),
    ],
  }),
];
