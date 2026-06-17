import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsCircleMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/circle",
  domain: "mathematics",
  key: "lesson.mathematics.circle",
  kind: "lesson",
  slug: "circle",
  routeSlugs: { en: "circle", id: "lingkaran" },
  translations: {
    en: {
      description: "Relate central and inscribed angles in circles.",
      title: "Circle",
    },
    id: {
      description: "Hubungkan sudut pusat dan keliling pada lingkaran.",
      title: "Lingkaran",
    },
  },
  sections: [
    {
      slug: "central-angle-and-inscribed-angle",
      routeSlugs: {
        en: "central-angle-and-inscribed-angle",
        id: "sudut-pusat-dan-sudut-keliling",
      },
      translations: {
        en: {
          title: "Central Angle and Inscribed Angle",
        },
        id: {
          title: "Sudut Pusat dan Sudut Keliling",
        },
      },
    },
    {
      slug: "circle-and-arc-circle",
      routeSlugs: {
        en: "circle-and-arc-circle",
        id: "lingkaran-dan-busur-lingkaran",
      },
      translations: {
        en: {
          title: "Circle and Arc Circle",
        },
        id: {
          title: "Lingkaran dan Busur Lingkaran",
        },
      },
    },
    {
      slug: "circle-and-chord",
      routeSlugs: { en: "circle-and-chord", id: "lingkaran-dan-tali-busur" },
      translations: {
        en: {
          title: "Circle and Chord",
        },
        id: {
          title: "Lingkaran dan Tali Busur",
        },
      },
    },
    {
      slug: "circle-and-tangent-line",
      routeSlugs: {
        en: "circle-and-tangent-line",
        id: "lingkaran-dan-garis-singgung",
      },
      translations: {
        en: {
          title: "Circle and Tangent Line",
        },
        id: {
          title: "Lingkaran dan Garis Singgung",
        },
      },
    },
    {
      slug: "external-tangent-line-and-internal-tangent-line",
      routeSlugs: {
        en: "external-tangent-line-and-internal-tangent-line",
        id: "garis-singgung-persekutuan-luar-dan-dalam",
      },
      translations: {
        en: {
          title: "External Tangent Line and Internal Tangent Line",
        },
        id: {
          title: "Garis Singgung Persekutuan Luar dan Dalam",
        },
      },
    },
    {
      slug: "properties-of-angle-in-circle",
      routeSlugs: {
        en: "properties-of-angle-in-circle",
        id: "sifat-sudut-dalam-lingkaran",
      },
      translations: {
        en: {
          title: "Properties of Angle in Circle",
        },
        id: {
          title: "Sifat Sudut dalam Lingkaran",
        },
      },
    },
  ],
});
