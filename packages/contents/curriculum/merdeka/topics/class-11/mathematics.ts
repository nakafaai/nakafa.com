import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const merdekaClass11MathematicsTopicNodes = [
  unitNode({
    key: "class-11-mathematics-circle",
    materialCard: {
      en: {
        description: "Relate central and inscribed angles.",
        title: "Circles",
      },
      id: {
        description: "Hubungkan sudut pusat dan keliling.",
        title: "Lingkaran",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-circle-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.circle"],
        order: 10,
      }),
    ],
    order: 10,
    translations: {
      en: { routeSlug: "circle", title: "Circles" },
      id: { routeSlug: "lingkaran", title: "Lingkaran" },
    },
  }),
  unitNode({
    key: "class-11-mathematics-complex-number",
    materialCard: {
      en: {
        description: "Add complex numbers with geometry.",
        title: "Complex Numbers",
      },
      id: {
        description: "Jumlahkan bilangan kompleks lewat geometri.",
        title: "Bilangan Kompleks",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-complex-number-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.complex-number"],
        order: 10,
      }),
    ],
    order: 20,
    translations: {
      en: { routeSlug: "complex-number", title: "Complex Numbers" },
      id: { routeSlug: "bilangan-kompleks", title: "Bilangan Kompleks" },
    },
  }),
  unitNode({
    key: "class-11-mathematics-function-composition-inverse-function",
    materialCard: {
      en: {
        description: "Operate on functions and domains.",
        title: "Function Composition and Inverses",
      },
      id: {
        description: "Operasikan fungsi dan domainnya.",
        title: "Komposisi dan Invers Fungsi",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-function-composition-inverse-function-material",
        level: "lesson",
        materialKeys: [
          "lesson.mathematics.function-composition-inverse-function",
        ],
        order: 10,
      }),
    ],
    order: 30,
    translations: {
      en: {
        routeSlug: "function-composition-inverse-function",
        title: "Function Composition and Inverses",
      },
      id: {
        routeSlug: "fungsi-komposisi-dan-fungsi-invers",
        title: "Komposisi dan Invers Fungsi",
      },
    },
  }),
  unitNode({
    key: "class-11-mathematics-function-modeling",
    materialCard: {
      en: {
        description: "Model absolute value behavior.",
        title: "Function Modeling",
      },
      id: {
        description: "Modelkan perilaku nilai mutlak.",
        title: "Pemodelan Fungsi",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-function-modeling-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.function-modeling"],
        order: 10,
      }),
    ],
    order: 40,
    translations: {
      en: { routeSlug: "function-modeling", title: "Function Modeling" },
      id: { routeSlug: "fungsi-dan-pemodelannya", title: "Pemodelan Fungsi" },
    },
  }),
  unitNode({
    key: "class-11-mathematics-geometric-transformation",
    materialCard: {
      en: {
        description: "Combine transformations with matrices.",
        title: "Geometric Transformations",
      },
      id: {
        description: "Gabungkan transformasi dengan matriks.",
        title: "Transformasi Geometri",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-geometric-transformation-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.geometric-transformation"],
        order: 10,
      }),
    ],
    order: 50,
    translations: {
      en: {
        routeSlug: "geometric-transformation",
        title: "Geometric Transformations",
      },
      id: {
        routeSlug: "transformasi-geometri",
        title: "Transformasi Geometri",
      },
    },
  }),
  unitNode({
    key: "class-11-mathematics-matrix",
    materialCard: {
      en: {
        description: "Compute determinants from minors.",
        title: "Matrices",
      },
      id: {
        description: "Hitung determinan dari minor.",
        title: "Matriks",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-matrix-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.matrix"],
        order: 10,
      }),
    ],
    order: 60,
    translations: {
      en: { routeSlug: "matrix", title: "Matrices" },
      id: { routeSlug: "matriks", title: "Matriks" },
    },
  }),
  unitNode({
    key: "class-11-mathematics-polynomial",
    materialCard: {
      en: {
        description: "Combine like terms in polynomials.",
        title: "Polynomials",
      },
      id: {
        description: "Gabungkan suku sejenis polinomial.",
        title: "Polinomial",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-polynomial-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.polynomial"],
        order: 10,
      }),
    ],
    order: 70,
    translations: {
      en: { routeSlug: "polynomial", title: "Polynomials" },
      id: { routeSlug: "polinomial", title: "Polinomial" },
    },
  }),
  unitNode({
    key: "class-11-mathematics-statistics-regression",
    materialCard: {
      en: {
        description: "Read how models explain variation.",
        title: "Regression Statistics",
      },
      id: {
        description: "Baca cara model menjelaskan variasi.",
        title: "Statistika Regresi",
      },
    },
    children: [
      materialNode({
        key: "class-11-mathematics-statistics-regression-material",
        level: "lesson",
        materialKeys: ["lesson.mathematics.statistics-regression"],
        order: 10,
      }),
    ],
    order: 80,
    translations: {
      en: {
        routeSlug: "statistics-regression",
        title: "Regression Statistics",
      },
      id: { routeSlug: "regresi-statistik", title: "Statistika Regresi" },
    },
  }),
];
