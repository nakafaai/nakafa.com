import type { CurriculumNodeInput } from "@repo/contents/_types/curriculum/schema";

export const igcseMathematicsNodes = [
  {
    key: "mathematics-0580-algebra-graphs",
    level: "unit",
    materialKeys: [],
    order: 20,
    parentKey: "mathematics-0580",
    translations: {
      en: { title: "Algebra and graphs" },
      id: { title: "Aljabar dan grafik" },
    },
  },
  {
    key: "mathematics-0580-algebra-graphs-linear-equations",
    level: "lesson",
    materialKeys: ["lesson.mathematics.linear-equation-inequality"],
    order: 10,
    parentKey: "mathematics-0580-algebra-graphs",
    translations: {
      en: { title: "Linear equations and inequalities" },
      id: { title: "Persamaan dan pertidaksamaan linear" },
    },
  },
  {
    key: "mathematics-0580-algebra-graphs-quadratics",
    level: "lesson",
    materialKeys: ["lesson.mathematics.quadratic-function"],
    order: 20,
    parentKey: "mathematics-0580-algebra-graphs",
    translations: {
      en: { title: "Quadratic functions" },
      id: { title: "Fungsi kuadrat" },
    },
  },
  {
    key: "mathematics-0580-algebra-graphs-sequences",
    level: "lesson",
    materialKeys: ["lesson.mathematics.sequence-series"],
    order: 30,
    parentKey: "mathematics-0580-algebra-graphs",
    translations: {
      en: { title: "Sequences and series" },
      id: { title: "Barisan dan deret" },
    },
  },
  {
    key: "mathematics-0580-algebra-graphs-functions",
    level: "lesson",
    materialKeys: ["lesson.mathematics.function-modeling"],
    order: 40,
    parentKey: "mathematics-0580-algebra-graphs",
    translations: {
      en: { title: "Function modelling" },
      id: { title: "Pemodelan fungsi" },
    },
  },
  {
    key: "mathematics-0580-geometry",
    level: "unit",
    materialKeys: [],
    order: 30,
    parentKey: "mathematics-0580",
    translations: {
      en: { title: "Geometry, mensuration, and trigonometry" },
      id: { title: "Geometri, pengukuran, dan trigonometri" },
    },
  },
  {
    key: "mathematics-0580-geometry-circles",
    level: "lesson",
    materialKeys: ["lesson.mathematics.circle"],
    order: 10,
    parentKey: "mathematics-0580-geometry",
    translations: {
      en: { title: "Circle geometry" },
      id: { title: "Geometri lingkaran" },
    },
  },
  {
    key: "mathematics-0580-geometry-arcs-sectors",
    level: "lesson",
    materialKeys: ["lesson.mathematics.circle-arc-sector"],
    order: 20,
    parentKey: "mathematics-0580-geometry",
    translations: {
      en: { title: "Arcs and sectors" },
      id: { title: "Busur dan juring" },
    },
  },
  {
    key: "mathematics-0580-geometry-coordinate-geometry",
    level: "lesson",
    materialKeys: ["lesson.mathematics.analytic-geometry"],
    order: 30,
    parentKey: "mathematics-0580-geometry",
    translations: {
      en: { title: "Coordinate geometry" },
      id: { title: "Geometri koordinat" },
    },
  },
  {
    key: "mathematics-0580-geometry-trigonometry",
    level: "lesson",
    materialKeys: ["lesson.mathematics.trigonometry"],
    order: 40,
    parentKey: "mathematics-0580-geometry",
    translations: {
      en: { title: "Trigonometry" },
      id: { title: "Trigonometri" },
    },
  },
  {
    key: "mathematics-0580-transformations-vectors",
    level: "unit",
    materialKeys: [],
    order: 40,
    parentKey: "mathematics-0580",
    translations: {
      en: { title: "Transformations and vectors" },
      id: { title: "Transformasi dan vektor" },
    },
  },
  {
    key: "mathematics-0580-transformations-vectors-transformations",
    level: "lesson",
    materialKeys: ["lesson.mathematics.geometric-transformation"],
    order: 10,
    parentKey: "mathematics-0580-transformations-vectors",
    translations: {
      en: { title: "Geometric transformations" },
      id: { title: "Transformasi geometri" },
    },
  },
  {
    key: "mathematics-0580-transformations-vectors-vectors",
    level: "lesson",
    materialKeys: ["lesson.mathematics.vector-operations"],
    order: 20,
    parentKey: "mathematics-0580-transformations-vectors",
    translations: {
      en: { title: "Vectors" },
      id: { title: "Vektor" },
    },
  },
  {
    key: "mathematics-0580-probability-statistics",
    level: "unit",
    materialKeys: [],
    order: 50,
    parentKey: "mathematics-0580",
    translations: {
      en: { title: "Probability and statistics" },
      id: { title: "Peluang dan statistika" },
    },
  },
  {
    key: "mathematics-0580-probability-statistics-probability",
    level: "lesson",
    materialKeys: ["lesson.mathematics.probability"],
    order: 10,
    parentKey: "mathematics-0580-probability-statistics",
    translations: {
      en: { title: "Probability" },
      id: { title: "Peluang" },
    },
  },
  {
    key: "mathematics-0580-probability-statistics-summary-statistics",
    level: "lesson",
    materialKeys: ["lesson.mathematics.statistics-foundations"],
    order: 20,
    parentKey: "mathematics-0580-probability-statistics",
    translations: {
      en: { title: "Summary statistics" },
      id: { title: "Statistika ringkas" },
    },
  },
] satisfies readonly CurriculumNodeInput[];
