import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsCircleMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/circle",
  domain: "mathematics",
  key: "lesson.mathematics.circle",
  kind: "lesson",
  slug: "circle",
  translations: {
    en: {
      description:
        "Learn central and inscribed angles in circles. Learn the key relationship, theorems, and solve problems with worked examples and proofs.",
      title: "Circle",
    },
    id: {
      description:
        "Pelajari sudut pusat dan keliling lingkaran. Pahami hubungan, teorema, dan cara menghitung dengan contoh soal dan pembuktian matematis.",
      title: "Lingkaran",
    },
  },
  sections: [
    {
      slug: "central-angle-and-inscribed-angle",
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
