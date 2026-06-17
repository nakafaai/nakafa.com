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
        description:
          "Study equations, sequences, functions, and graphs as connected algebra tools.",
        routeSlug: "algebra-and-graphs",
        title: "Algebra and graphs",
      },
      id: {
        description:
          "Pelajari persamaan, barisan, fungsi, dan grafik sebagai alat aljabar yang saling terhubung.",
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
        description:
          "Use circle, coordinate, mensuration, and trigonometry ideas to solve shape problems.",
        routeSlug: "geometry-mensuration-and-trigonometry",
        title: "Geometry, mensuration, and trigonometry",
      },
      id: {
        description:
          "Gunakan konsep lingkaran, koordinat, pengukuran, dan trigonometri untuk soal bentuk.",
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
        description:
          "Describe movement, direction, and position with transformations and vectors.",
        routeSlug: "transformations-and-vectors",
        title: "Transformations and vectors",
      },
      id: {
        description:
          "Jelaskan perpindahan, arah, dan posisi dengan transformasi dan vektor.",
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
        description:
          "Interpret probability situations and data summaries before drawing conclusions.",
        routeSlug: "probability-and-statistics",
        title: "Probability and statistics",
      },
      id: {
        description:
          "Tafsirkan peluang dan ringkasan data sebelum menarik kesimpulan.",
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
