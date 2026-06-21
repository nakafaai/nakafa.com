import {
  courseNode,
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const usHighSchoolMathematicsCourseNode = courseNode({
  children: [
    unitNode({
      children: [
        materialNode({
          key: "us-high-school-mathematics-number-complex",
          level: "lesson",
          materialKeys: ["lesson.mathematics.complex-number"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-mathematics-number-vectors",
          level: "lesson",
          materialKeys: ["lesson.mathematics.vector-operations"],
          order: 20,
        }),
        materialNode({
          key: "us-high-school-mathematics-number-matrices",
          level: "lesson",
          materialKeys: ["lesson.mathematics.matrix"],
          order: 30,
        }),
      ],
      key: "high-school-mathematics-number-quantity",
      materialCard: {
        en: {
          description: "Use complex numbers, vectors, and matrices.",
          title: "Number and Quantity",
        },
        id: {
          description: "Gunakan bilangan kompleks, vektor, dan matriks.",
          title: "Bilangan dan Kuantitas",
        },
      },
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
      children: [
        materialNode({
          key: "us-high-school-mathematics-algebra-linear",
          level: "lesson",
          materialKeys: ["lesson.mathematics.linear-equation-inequality"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-mathematics-algebra-quadratic",
          level: "lesson",
          materialKeys: ["lesson.mathematics.quadratic-function"],
          order: 20,
        }),
        materialNode({
          key: "us-high-school-mathematics-algebra-polynomial",
          level: "lesson",
          materialKeys: ["lesson.mathematics.polynomial"],
          order: 30,
        }),
        materialNode({
          key: "us-high-school-mathematics-algebra-exponential",
          level: "lesson",
          materialKeys: ["lesson.mathematics.exponential-logarithm"],
          order: 40,
        }),
      ],
      key: "high-school-mathematics-algebra",
      materialCard: {
        en: {
          description: "Solve equations, polynomials, and exponentials.",
          title: "Algebra",
        },
        id: {
          description: "Selesaikan persamaan, polinom, dan eksponen.",
          title: "Aljabar",
        },
      },
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
      children: [
        materialNode({
          key: "us-high-school-mathematics-functions-modeling",
          level: "lesson",
          materialKeys: ["lesson.mathematics.function-modeling"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-mathematics-functions-composition",
          level: "lesson",
          materialKeys: [
            "lesson.mathematics.function-composition-inverse-function",
          ],
          order: 20,
        }),
        materialNode({
          key: "us-high-school-mathematics-functions-transformations",
          level: "lesson",
          materialKeys: ["lesson.mathematics.function-transformation"],
          order: 30,
        }),
      ],
      key: "high-school-mathematics-functions",
      materialCard: {
        en: {
          description: "Model, compose, and transform functions.",
          title: "Functions",
        },
        id: {
          description: "Modelkan, susun, dan ubah fungsi.",
          title: "Fungsi",
        },
      },
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
      children: [
        materialNode({
          key: "us-high-school-mathematics-geometry-circle",
          level: "lesson",
          materialKeys: ["lesson.mathematics.circle"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-mathematics-geometry-coordinate",
          level: "lesson",
          materialKeys: ["lesson.mathematics.analytic-geometry"],
          order: 20,
        }),
        materialNode({
          key: "us-high-school-mathematics-geometry-trigonometry",
          level: "lesson",
          materialKeys: ["lesson.mathematics.trigonometry"],
          order: 30,
        }),
      ],
      key: "high-school-mathematics-geometry",
      materialCard: {
        en: {
          description: "Use circles, coordinates, and trigonometry.",
          title: "Geometry",
        },
        id: {
          description: "Gunakan lingkaran, koordinat, dan trigonometri.",
          title: "Geometri",
        },
      },
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
      children: [
        materialNode({
          key: "us-high-school-mathematics-statistics",
          level: "lesson",
          materialKeys: ["lesson.mathematics.statistics-foundations"],
          order: 10,
        }),
        materialNode({
          key: "us-high-school-mathematics-probability",
          level: "lesson",
          materialKeys: ["lesson.mathematics.probability"],
          order: 20,
        }),
        materialNode({
          key: "us-high-school-mathematics-regression",
          level: "lesson",
          materialKeys: ["lesson.mathematics.statistics-regression"],
          order: 30,
        }),
      ],
      key: "high-school-mathematics-statistics-probability",
      materialCard: {
        en: {
          description: "Read data, chance, and regression models.",
          title: "Statistics and Probability",
        },
        id: {
          description: "Baca data, peluang, dan model regresi.",
          title: "Statistika dan Peluang",
        },
      },
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
  key: "high-school-mathematics",
  materialDomain: "mathematics",
  order: 10,
  translations: {
    en: {
      routeSlug: "mathematics",
      title: "Mathematics",
    },
    id: {
      routeSlug: "matematika",
      title: "Matematika",
    },
  },
});
