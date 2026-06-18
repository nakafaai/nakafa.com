import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const igcseBiologyUnitNodes = [
  unitNode({
    key: "biology-0610-living-organisms",
    materialCard: {
      en: {
        description: "Classify organisms and compare living systems.",
        title: "Living organisms",
      },
      id: {
        description: "Klasifikasi makhluk hidup dan sistemnya.",
        title: "Makhluk hidup",
      },
    },
    order: 10,
    translations: {
      en: {
        routeSlug: "living-organisms",
        title: "Living organisms",
      },
      id: {
        routeSlug: "makhluk-hidup",
        title: "Makhluk hidup",
      },
    },
    children: [
      materialNode({
        key: "biology-0610-living-organisms-biodiversity",
        level: "lesson",
        materialKeys: ["lesson.biology.biodiversity"],
        order: 10,
      }),
    ],
  }),
  unitNode({
    key: "biology-0610-disease-ecosystems",
    materialCard: {
      en: {
        description: "Connect viruses, ecosystems, and climate effects.",
        title: "Disease and ecosystems",
      },
      id: {
        description: "Hubungkan virus, ekosistem, dan iklim.",
        title: "Penyakit dan ekosistem",
      },
    },
    order: 20,
    translations: {
      en: {
        routeSlug: "disease-and-ecosystems",
        title: "Disease and ecosystems",
      },
      id: {
        routeSlug: "penyakit-dan-ekosistem",
        title: "Penyakit dan ekosistem",
      },
    },
    children: [
      materialNode({
        key: "biology-0610-disease-ecosystems-virus",
        level: "lesson",
        materialKeys: ["lesson.biology.virus-role"],
        order: 10,
      }),
      materialNode({
        key: "biology-0610-disease-ecosystems-climate",
        level: "lesson",
        materialKeys: ["lesson.biology.climate-change"],
        order: 20,
      }),
    ],
  }),
];

export const igcseChemistryUnitNodes = [
  unitNode({
    key: "chemistry-0620-matter-reactions",
    materialCard: {
      en: {
        description: "Model atoms, reactions, and chemical laws.",
        title: "Matter and reactions",
      },
      id: {
        description: "Modelkan atom, reaksi, dan hukum kimia.",
        title: "Materi dan reaksi",
      },
    },
    order: 10,
    translations: {
      en: {
        routeSlug: "matter-and-reactions",
        title: "Matter and reactions",
      },
      id: {
        routeSlug: "materi-dan-reaksi",
        title: "Materi dan reaksi",
      },
    },
    children: [
      materialNode({
        key: "chemistry-0620-matter-reactions-atomic-structure",
        level: "lesson",
        materialKeys: ["lesson.chemistry.structure-matter"],
        order: 10,
      }),
      materialNode({
        key: "chemistry-0620-matter-reactions-basic-laws",
        level: "lesson",
        materialKeys: ["lesson.chemistry.basic-chemistry-laws"],
        order: 20,
      }),
    ],
  }),
  unitNode({
    key: "chemistry-0620-environment",
    materialCard: {
      en: {
        description: "Judge reactions with greener chemistry choices.",
        title: "Environmental chemistry",
      },
      id: {
        description: "Nilai reaksi dengan pilihan kimia hijau.",
        title: "Kimia lingkungan",
      },
    },
    order: 20,
    translations: {
      en: {
        routeSlug: "environmental-chemistry",
        title: "Environmental chemistry",
      },
      id: {
        routeSlug: "kimia-lingkungan",
        title: "Kimia lingkungan",
      },
    },
    children: [
      materialNode({
        key: "chemistry-0620-environment-green-chemistry",
        level: "lesson",
        materialKeys: ["lesson.chemistry.green-chemistry"],
        order: 10,
      }),
    ],
  }),
];

export const igcsePhysicsUnitNodes = [
  unitNode({
    key: "physics-0625-measurement-motion",
    materialCard: {
      en: {
        description: "Measure motion, vectors, and forces clearly.",
        title: "Measurement, motion, and forces",
      },
      id: {
        description: "Ukur gerak, vektor, dan gaya dengan jelas.",
        title: "Pengukuran, gerak, dan gaya",
      },
    },
    order: 10,
    translations: {
      en: {
        routeSlug: "measurement-motion-and-forces",
        title: "Measurement, motion, and forces",
      },
      id: {
        routeSlug: "pengukuran-gerak-dan-gaya",
        title: "Pengukuran, gerak, dan gaya",
      },
    },
    children: [
      materialNode({
        key: "physics-0625-measurement-motion-measurement",
        level: "lesson",
        materialKeys: ["lesson.physics.measurement"],
        order: 10,
      }),
      materialNode({
        key: "physics-0625-measurement-motion-kinematics",
        level: "lesson",
        materialKeys: ["lesson.physics.kinematics"],
        order: 20,
      }),
      materialNode({
        key: "physics-0625-measurement-motion-vector",
        level: "lesson",
        materialKeys: ["lesson.physics.vector"],
        order: 30,
      }),
    ],
  }),
  unitNode({
    key: "physics-0625-energy",
    materialCard: {
      en: {
        description: "Compare energy sources and their tradeoffs.",
        title: "Energy",
      },
      id: {
        description: "Bandingkan sumber energi dan dampaknya.",
        title: "Energi",
      },
    },
    order: 20,
    translations: {
      en: {
        routeSlug: "energy",
        title: "Energy",
      },
      id: {
        routeSlug: "energi",
        title: "Energi",
      },
    },
    children: [
      materialNode({
        key: "physics-0625-energy-renewable-energy",
        level: "lesson",
        materialKeys: ["lesson.physics.renewable-energy"],
        order: 10,
      }),
    ],
  }),
];
