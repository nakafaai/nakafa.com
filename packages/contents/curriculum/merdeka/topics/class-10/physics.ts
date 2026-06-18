import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const merdekaClass10PhysicsTopicNodes = [
  unitNode({
    key: "class-10-physics-measurement",
    materialCard: {
      en: {
        description: "Use units and measuring tools well.",
        title: "Measurement",
      },
      id: {
        description: "Gunakan satuan dan alat ukur dengan tepat.",
        title: "Pengukuran",
      },
    },
    children: [
      materialNode({
        key: "class-10-physics-measurement-material",
        level: "lesson",
        materialKeys: ["lesson.physics.measurement"],
        order: 10,
      }),
    ],
    order: 10,
    translations: {
      en: { routeSlug: "measurement", title: "Measurement" },
      id: { routeSlug: "pengukuran-dalam-kerja-ilmiah", title: "Pengukuran" },
    },
  }),
  unitNode({
    key: "class-10-physics-renewable-energy",
    materialCard: {
      en: {
        description: "Compare energy sources and impacts.",
        title: "Renewable Energy",
      },
      id: {
        description: "Bandingkan sumber energi dan dampaknya.",
        title: "Energi Terbarukan",
      },
    },
    children: [
      materialNode({
        key: "class-10-physics-renewable-energy-material",
        level: "lesson",
        materialKeys: ["lesson.physics.renewable-energy"],
        order: 10,
      }),
    ],
    order: 20,
    translations: {
      en: { routeSlug: "renewable-energy", title: "Renewable Energy" },
      id: { routeSlug: "energi-terbarukan", title: "Energi Terbarukan" },
    },
  }),
];
