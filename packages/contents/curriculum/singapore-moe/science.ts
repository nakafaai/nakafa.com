import {
  courseNode,
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const singaporeSecondaryScienceCourseNode = courseNode({
  children: [
    unitNode({
      children: [
        materialNode({
          key: "singapore-secondary-science-physics-measurement",
          level: "lesson",
          materialKeys: ["lesson.physics.measurement"],
          order: 10,
        }),
        materialNode({
          key: "singapore-secondary-science-physics-kinematics",
          level: "lesson",
          materialKeys: ["lesson.physics.kinematics"],
          order: 20,
        }),
        materialNode({
          key: "singapore-secondary-science-physics-energy",
          level: "lesson",
          materialKeys: ["lesson.physics.renewable-energy"],
          order: 30,
        }),
      ],
      key: "secondary-science-physics",
      materialCard: {
        en: {
          description: "Measure motion, vectors, and energy clearly.",
          title: "Physics",
        },
        id: {
          description: "Ukur gerak, vektor, dan energi dengan jelas.",
          title: "Fisika",
        },
      },
      materialDomain: "physics",
      order: 10,
      translations: {
        en: {
          routeSlug: "physics",
          title: "Physics",
        },
        id: {
          routeSlug: "fisika",
          title: "Fisika",
        },
      },
    }),
    unitNode({
      children: [
        materialNode({
          key: "singapore-secondary-science-chemistry-matter",
          level: "lesson",
          materialKeys: ["lesson.chemistry.structure-matter"],
          order: 10,
        }),
        materialNode({
          key: "singapore-secondary-science-chemistry-reactions",
          level: "lesson",
          materialKeys: ["lesson.chemistry.basic-chemistry-laws"],
          order: 20,
        }),
      ],
      key: "secondary-science-chemistry",
      materialCard: {
        en: {
          description: "Model matter and reactions from evidence.",
          title: "Chemistry",
        },
        id: {
          description: "Modelkan materi dan reaksi dari bukti.",
          title: "Kimia",
        },
      },
      materialDomain: "chemistry",
      order: 20,
      translations: {
        en: {
          routeSlug: "chemistry",
          title: "Chemistry",
        },
        id: {
          routeSlug: "kimia",
          title: "Kimia",
        },
      },
    }),
    unitNode({
      children: [
        materialNode({
          key: "singapore-secondary-science-biology-living-systems",
          level: "lesson",
          materialKeys: ["lesson.biology.biodiversity"],
          order: 10,
        }),
        materialNode({
          key: "singapore-secondary-science-biology-ecosystems",
          level: "lesson",
          materialKeys: ["lesson.biology.climate-change"],
          order: 20,
        }),
      ],
      key: "secondary-science-biology",
      materialCard: {
        en: {
          description: "Study living systems and ecosystem change.",
          title: "Biology",
        },
        id: {
          description: "Pelajari sistem hayati dan perubahan ekosistem.",
          title: "Biologi",
        },
      },
      materialDomain: "biology",
      order: 30,
      translations: {
        en: {
          routeSlug: "biology",
          title: "Biology",
        },
        id: {
          routeSlug: "biologi",
          title: "Biologi",
        },
      },
    }),
  ],
  iconKey: "science",
  key: "secondary-science",
  order: 30,
  translations: {
    en: {
      routeSlug: "science",
      title: "Science",
    },
    id: {
      routeSlug: "sains",
      title: "Sains",
    },
  },
});
