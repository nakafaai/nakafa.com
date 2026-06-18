import {
  courseNode,
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const singaporeSecondaryMathematicsCourseNode = courseNode({
  children: [
    unitNode({
      children: [
        materialNode({
          key: "singapore-secondary-mathematics-linear-equations",
          level: "lesson",
          materialKeys: ["lesson.mathematics.linear-equation-inequality"],
          order: 10,
        }),
        materialNode({
          key: "singapore-secondary-mathematics-quadratics",
          level: "lesson",
          materialKeys: ["lesson.mathematics.quadratic-function"],
          order: 20,
        }),
        materialNode({
          key: "singapore-secondary-mathematics-exponents",
          level: "lesson",
          materialKeys: ["lesson.mathematics.exponential-logarithm"],
          order: 30,
        }),
      ],
      key: "secondary-mathematics-number-algebra",
      order: 10,
      translations: {
        en: {
          routeSlug: "number-and-algebra",
          title: "Number and algebra",
        },
        id: {
          routeSlug: "bilangan-dan-aljabar",
          title: "Bilangan dan aljabar",
        },
      },
    }),
    unitNode({
      children: [
        materialNode({
          key: "singapore-secondary-mathematics-geometry",
          level: "lesson",
          materialKeys: ["lesson.mathematics.trigonometry"],
          order: 10,
        }),
        materialNode({
          key: "singapore-secondary-mathematics-statistics",
          level: "lesson",
          materialKeys: ["lesson.mathematics.statistics-foundations"],
          order: 20,
        }),
        materialNode({
          key: "singapore-secondary-mathematics-probability",
          level: "lesson",
          materialKeys: ["lesson.mathematics.probability"],
          order: 30,
        }),
      ],
      key: "secondary-mathematics-geometry-statistics",
      order: 20,
      translations: {
        en: {
          routeSlug: "geometry-statistics-and-probability",
          title: "Geometry, statistics, and probability",
        },
        id: {
          routeSlug: "geometri-statistika-dan-peluang",
          title: "Geometri, statistika, dan peluang",
        },
      },
    }),
  ],
  iconKey: "advanced",
  key: "secondary-mathematics",
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

export const singaporeSecondaryAdditionalMathematicsCourseNode = courseNode({
  children: [
    unitNode({
      children: [
        materialNode({
          key: "singapore-secondary-additional-mathematics-functions",
          level: "lesson",
          materialKeys: ["lesson.mathematics.function-modeling"],
          order: 10,
        }),
        materialNode({
          key: "singapore-secondary-additional-mathematics-derivative",
          level: "lesson",
          materialKeys: ["lesson.mathematics.derivative-function"],
          order: 20,
        }),
        materialNode({
          key: "singapore-secondary-additional-mathematics-integral",
          level: "lesson",
          materialKeys: ["lesson.mathematics.integral"],
          order: 30,
        }),
      ],
      key: "secondary-additional-mathematics-functions-calculus",
      order: 10,
      translations: {
        en: {
          routeSlug: "functions-and-calculus",
          title: "Functions and calculus",
        },
        id: {
          routeSlug: "fungsi-dan-kalkulus",
          title: "Fungsi dan kalkulus",
        },
      },
    }),
  ],
  iconKey: "mathematics",
  key: "secondary-additional-mathematics",
  materialDomain: "mathematics",
  order: 20,
  translations: {
    en: {
      routeSlug: "additional-mathematics",
      title: "Additional Mathematics",
    },
    id: {
      routeSlug: "additional-mathematics",
      title: "Additional Mathematics",
    },
  },
});
