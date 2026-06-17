import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsAnalyticGeometryMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/analytic-geometry",
  domain: "mathematics",
  key: "lesson.mathematics.analytic-geometry",
  kind: "lesson",
  slug: "analytic-geometry",
  routeSlugs: { en: "analytic-geometry", id: "geometri-analitik" },
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
      routeSlugs: { en: "definition-of-circle", id: "definisi-lingkaran" },
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
      routeSlugs: { en: "ellipse", id: "elips" },
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
      routeSlugs: {
        en: "equation-of-a-tangent-line-to-a-circle",
        id: "persamaan-garis-singgung-lingkaran",
      },
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
      routeSlugs: { en: "equation-of-circle", id: "persamaan-lingkaran" },
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
      routeSlugs: { en: "hyperbola", id: "hiperbola" },
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
      routeSlugs: { en: "parabola", id: "parabola" },
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
      routeSlugs: {
        en: "position-of-a-line-to-a-circle",
        id: "kedudukan-garis-terhadap-lingkaran",
      },
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
      routeSlugs: {
        en: "position-of-a-point-to-a-circle",
        id: "kedudukan-suatu-titik-terhadap-lingkaran",
      },
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
      routeSlugs: {
        en: "position-of-a-tangent-line-to-a-circle",
        id: "kedudukan-garis-singgung-lingkaran",
      },
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
      routeSlugs: {
        en: "position-of-two-circles",
        id: "kedudukan-dua-lingkaran",
      },
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
      routeSlugs: {
        en: "tangent-line-to-conic-sections",
        id: "garis-singgung-pada-irisan-kerucut",
      },
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
