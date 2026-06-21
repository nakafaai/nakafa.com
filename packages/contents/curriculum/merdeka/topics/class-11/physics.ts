import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const merdekaClass11PhysicsTopicNodes = [
  unitNode({
    key: "class-11-physics-kinematics",
    materialCard: {
      en: {
        description: "Track position, speed, and acceleration.",
        title: "Kinematics",
      },
      id: {
        description: "Lacak posisi, kecepatan, dan percepatan.",
        title: "Kinematika",
      },
    },
    children: [
      materialNode({
        key: "class-11-physics-kinematics-material",
        level: "lesson",
        materialKeys: ["lesson.physics.kinematics"],
        order: 10,
      }),
    ],
    order: 10,
    translations: {
      en: { routeSlug: "kinematics", title: "Kinematics" },
      id: { routeSlug: "kinematika", title: "Kinematika" },
    },
  }),
  unitNode({
    key: "class-11-physics-vector",
    materialCard: {
      en: {
        description: "Use vector direction in motion problems.",
        title: "Vectors in Physics",
      },
      id: {
        description: "Gunakan arah vektor dalam soal gerak.",
        title: "Vektor dalam Fisika",
      },
    },
    children: [
      materialNode({
        key: "class-11-physics-vector-material",
        level: "lesson",
        materialKeys: ["lesson.physics.vector"],
        order: 10,
      }),
    ],
    order: 20,
    translations: {
      en: { routeSlug: "vector", title: "Vectors in Physics" },
      id: { routeSlug: "vektor", title: "Vektor dalam Fisika" },
    },
  }),
];
