import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const merdekaClass10MathematicsTopicNodes = [
  unitNode({
    key: "class-10-mathematics-exponential-logarithm",
    materialCard: {
      en: {
        description: "Connect repeated multiplication to exponents.",
        title: "Exponents and Logarithms",
      },
      id: {
        description: "Hubungkan perkalian berulang dan eksponen.",
        title: "Eksponen dan Logaritma",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-exponential-logarithm-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.exponential-logarithm"],
        order: 10,
      }),
    ],
    order: 10,
    translations: {
      en: {
        routeSlug: "exponential-logarithm",
        title: "Exponents and Logarithms",
      },
      id: {
        routeSlug: "eksponen-dan-logaritma",
        title: "Eksponen dan Logaritma",
      },
    },
  }),
  unitNode({
    key: "class-10-mathematics-linear-equation-inequality",
    materialCard: {
      en: {
        description: "Solve linear relations with algebra.",
        title: "Linear Equations and Inequalities",
      },
      id: {
        description: "Selesaikan relasi linear dengan aljabar.",
        title: "Persamaan dan Pertidaksamaan Linear",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-linear-equation-inequality-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.linear-equation-inequality"],
        order: 10,
      }),
    ],
    order: 20,
    translations: {
      en: {
        routeSlug: "linear-equation-inequality",
        title: "Linear Equations and Inequalities",
      },
      id: {
        routeSlug: "sistem-persamaan-dan-pertidaksamaan-linear",
        title: "Persamaan dan Pertidaksamaan Linear",
      },
    },
  }),
  unitNode({
    key: "class-10-mathematics-probability",
    materialCard: {
      en: {
        description: "Use addition rules for chance.",
        title: "Probability",
      },
      id: {
        description: "Gunakan aturan penjumlahan peluang.",
        title: "Peluang",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-probability-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.probability"],
        order: 10,
      }),
    ],
    order: 30,
    translations: {
      en: { routeSlug: "probability", title: "Probability" },
      id: { routeSlug: "peluang", title: "Peluang" },
    },
  }),
  unitNode({
    key: "class-10-mathematics-quadratic-function",
    materialCard: {
      en: {
        description: "Read graphs, roots, and quadratic change.",
        title: "Quadratic Functions",
      },
      id: {
        description: "Baca grafik, akar, dan perubahan kuadrat.",
        title: "Fungsi Kuadrat",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-quadratic-function-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.quadratic-function"],
        order: 10,
      }),
    ],
    order: 40,
    translations: {
      en: { routeSlug: "quadratic-function", title: "Quadratic Functions" },
      id: {
        routeSlug: "persamaan-dan-fungsi-kuadrat",
        title: "Fungsi Kuadrat",
      },
    },
  }),
  unitNode({
    key: "class-10-mathematics-sequence-series",
    materialCard: {
      en: {
        description: "Find patterns, terms, and sums.",
        title: "Sequences and Series",
      },
      id: {
        description: "Temukan pola, suku, dan jumlah.",
        title: "Barisan dan Deret",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-sequence-series-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.sequence-series"],
        order: 10,
      }),
    ],
    order: 50,
    translations: {
      en: { routeSlug: "sequence-series", title: "Sequences and Series" },
      id: { routeSlug: "barisan-dan-deret", title: "Barisan dan Deret" },
    },
  }),
  unitNode({
    key: "class-10-mathematics-statistics-foundations",
    materialCard: {
      en: {
        description: "Choose the right center for data.",
        title: "Statistics",
      },
      id: {
        description: "Pilih ukuran pusat data yang tepat.",
        title: "Statistika",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-statistics-foundations-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.statistics-foundations"],
        order: 10,
      }),
    ],
    order: 60,
    translations: {
      en: { routeSlug: "statistics-foundations", title: "Statistics" },
      id: { routeSlug: "statistika-dasar", title: "Statistika" },
    },
  }),
  unitNode({
    key: "class-10-mathematics-trigonometry",
    materialCard: {
      en: {
        description: "Match triangle sides to ratios.",
        title: "Trigonometry",
      },
      id: {
        description: "Cocokkan sisi segitiga dengan rasio.",
        title: "Trigonometri",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-trigonometry-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.trigonometry"],
        order: 10,
      }),
    ],
    order: 70,
    translations: {
      en: { routeSlug: "trigonometry", title: "Trigonometry" },
      id: { routeSlug: "trigonometri", title: "Trigonometri" },
    },
  }),
  unitNode({
    key: "class-10-mathematics-vector-operations",
    materialCard: {
      en: {
        description: "Work with vector notation and direction.",
        title: "Vector Operations",
      },
      id: {
        description: "Olah notasi dan arah vektor.",
        title: "Operasi Vektor",
      },
    },
    children: [
      materialNode({
        key: "class-10-mathematics-vector-operations-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.vector-operations"],
        order: 10,
      }),
    ],
    order: 80,
    translations: {
      en: { routeSlug: "vector-operations", title: "Vector Operations" },
      id: { routeSlug: "vektor-dan-operasinya", title: "Operasi Vektor" },
    },
  }),
];
