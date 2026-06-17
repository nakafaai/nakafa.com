import { courseNode, unitNode } from "@repo/contents/_types/curriculum/schema";

export const commonCoreNgssStandardNodes = [
  courseNode({
    key: "high-school-mathematics",
    materialDomain: "mathematics",
    order: 10,
    translations: {
      en: {
        routeSlug: "high-school-mathematics",
        title: "High School Mathematics",
        description:
          "Study high school math through functions, geometry, and statistics.",
      },
      id: {
        routeSlug: "high-school-mathematics",
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
        key: "high-school-mathematics-algebra",
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
        key: "high-school-mathematics-functions",
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
        key: "high-school-mathematics-modeling",
        order: 40,
        translations: {
          en: {
            routeSlug: "modeling",
            title: "Modeling",
          },
          id: {
            routeSlug: "pemodelan",
            title: "Pemodelan",
          },
        },
      }),
      unitNode({
        key: "high-school-mathematics-geometry",
        order: 50,
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
        key: "high-school-mathematics-statistics-probability",
        order: 60,
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
  }),
  courseNode({
    key: "high-school-science",
    order: 20,
    translations: {
      en: {
        routeSlug: "high-school-science",
        title: "High School Science",
        description:
          "Explore physical science, life science, earth science, and engineering ideas.",
      },
      id: {
        routeSlug: "high-school-science",
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
        key: "high-school-science-life-sciences",
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
        key: "high-school-science-earth-space-sciences",
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
        key: "high-school-science-engineering",
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
  }),
];
