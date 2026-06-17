import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const igcseMathematicsUnitNodes = [
  unitNode({
    key: "mathematics-0580-algebra-graphs",
    order: 20,
    translations: {
      en: {
        routeSlug: "algebra-and-graphs",
        title: "Algebra and graphs",
      },
      id: {
        routeSlug: "aljabar-dan-grafik",
        title: "Aljabar dan grafik",
      },
    },
    children: [
      materialNode({
        key: "mathematics-0580-algebra-graphs-linear-equations",
        level: "lesson",
        materialKeys: ["lesson.mathematics.linear-equation-inequality"],
        order: 10,
      }),
      materialNode({
        key: "mathematics-0580-algebra-graphs-quadratics",
        level: "lesson",
        materialKeys: ["lesson.mathematics.quadratic-function"],
        order: 20,
      }),
      materialNode({
        key: "mathematics-0580-algebra-graphs-sequences",
        level: "lesson",
        materialKeys: ["lesson.mathematics.sequence-series"],
        order: 30,
      }),
      materialNode({
        key: "mathematics-0580-algebra-graphs-functions",
        level: "lesson",
        materialKeys: ["lesson.mathematics.function-modeling"],
        order: 40,
      }),
    ],
  }),
  unitNode({
    key: "mathematics-0580-geometry",
    order: 30,
    translations: {
      en: {
        routeSlug: "geometry-mensuration-and-trigonometry",
        title: "Geometry, mensuration, and trigonometry",
      },
      id: {
        routeSlug: "geometri-pengukuran-dan-trigonometri",
        title: "Geometri, pengukuran, dan trigonometri",
      },
    },
    children: [
      materialNode({
        key: "mathematics-0580-geometry-circles",
        level: "lesson",
        materialKeys: ["lesson.mathematics.circle"],
        order: 10,
      }),
      materialNode({
        key: "mathematics-0580-geometry-arcs-sectors",
        level: "lesson",
        materialKeys: ["lesson.mathematics.circle-arc-sector"],
        order: 20,
      }),
      materialNode({
        key: "mathematics-0580-geometry-coordinate-geometry",
        level: "lesson",
        materialKeys: ["lesson.mathematics.analytic-geometry"],
        order: 30,
      }),
      materialNode({
        key: "mathematics-0580-geometry-trigonometry",
        level: "lesson",
        materialKeys: ["lesson.mathematics.trigonometry"],
        order: 40,
      }),
    ],
  }),
  unitNode({
    key: "mathematics-0580-transformations-vectors",
    order: 40,
    translations: {
      en: {
        routeSlug: "transformations-and-vectors",
        title: "Transformations and vectors",
      },
      id: {
        routeSlug: "transformasi-dan-vektor",
        title: "Transformasi dan vektor",
      },
    },
    children: [
      materialNode({
        key: "mathematics-0580-transformations-vectors-transformations",
        level: "lesson",
        materialKeys: ["lesson.mathematics.geometric-transformation"],
        order: 10,
      }),
      materialNode({
        key: "mathematics-0580-transformations-vectors-vectors",
        level: "lesson",
        materialKeys: ["lesson.mathematics.vector-operations"],
        order: 20,
      }),
    ],
  }),
  unitNode({
    key: "mathematics-0580-probability-statistics",
    order: 50,
    translations: {
      en: {
        routeSlug: "probability-and-statistics",
        title: "Probability and statistics",
      },
      id: {
        routeSlug: "peluang-dan-statistika",
        title: "Peluang dan statistika",
      },
    },
    children: [
      materialNode({
        key: "mathematics-0580-probability-statistics-probability",
        level: "lesson",
        materialKeys: ["lesson.mathematics.probability"],
        order: 10,
      }),
      materialNode({
        key: "mathematics-0580-probability-statistics-summary-statistics",
        level: "lesson",
        materialKeys: ["lesson.mathematics.statistics-foundations"],
        order: 20,
      }),
    ],
  }),
];
