import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsAnalyticGeometryMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/analytic-geometry",
  domain: "mathematics",
  key: "lesson.mathematics.analytic-geometry",
  kind: "lesson",
  slug: "analytic-geometry",
  translations: {
    en: {
      description:
        "Learn circle fundamentals such as center, radius, and equations, then derive (x-a)² + (y-b)² = r² with examples.",
      title: "Analytic Geometry",
    },
    id: {
      description:
        "Pelajari konsep dasar lingkaran dengan penjelasan pusat, jari-jari, dan persamaan. Pahami cara menurunkan (x-a)² + (y-b)² = r² dengan contoh interaktif.",
      title: "Geometri Analitik",
    },
  },
  sections: [
    {
      slug: "definition-of-circle",
      translations: {
        en: {
          title: "Definition of Circle",
        },
        id: {
          title: "Definisi Lingkaran",
        },
      },
    },
    {
      slug: "ellipse",
      translations: {
        en: {
          title: "Ellipse",
        },
        id: {
          title: "Elips",
        },
      },
    },
    {
      slug: "equation-of-a-tangent-line-to-a-circle",
      translations: {
        en: {
          title: "Equation of a Tangent Line to a Circle",
        },
        id: {
          title: "Persamaan Garis Singgung Lingkaran",
        },
      },
    },
    {
      slug: "equation-of-circle",
      translations: {
        en: {
          title: "Equation of Circle",
        },
        id: {
          title: "Persamaan Lingkaran",
        },
      },
    },
    {
      slug: "hyperbola",
      translations: {
        en: {
          title: "Hyperbola",
        },
        id: {
          title: "Hiperbola",
        },
      },
    },
    {
      slug: "parabola",
      translations: {
        en: {
          title: "Parabola",
        },
        id: {
          title: "Parabola",
        },
      },
    },
    {
      slug: "position-of-a-line-to-a-circle",
      translations: {
        en: {
          title: "Position of a Line to a Circle",
        },
        id: {
          title: "Kedudukan Garis Terhadap Lingkaran",
        },
      },
    },
    {
      slug: "position-of-a-point-to-a-circle",
      translations: {
        en: {
          title: "Position of a Point to a Circle",
        },
        id: {
          title: "Kedudukan Suatu Titik Terhadap Lingkaran",
        },
      },
    },
    {
      slug: "position-of-a-tangent-line-to-a-circle",
      translations: {
        en: {
          title: "Position of a Tangent Line to a Circle",
        },
        id: {
          title: "Kedudukan Garis Singgung Lingkaran",
        },
      },
    },
    {
      slug: "position-of-two-circles",
      translations: {
        en: {
          title: "Position of Two Circles",
        },
        id: {
          title: "Kedudukan Dua Lingkaran",
        },
      },
    },
    {
      slug: "tangent-line-to-conic-sections",
      translations: {
        en: {
          title: "Tangent Line to Conic Sections",
        },
        id: {
          title: "Garis Singgung pada Irisan Kerucut",
        },
      },
    },
  ],
});
