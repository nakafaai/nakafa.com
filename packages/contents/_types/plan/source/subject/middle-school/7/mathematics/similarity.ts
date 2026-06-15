import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectMiddleSchool7MathematicsSimilarityTopic =
  defineSubjectPlanTopic({
    slug: "similarity",
    translations: {
      en: {
        description:
          "Reading angles, side ratios, and scale factors in shapes, maps, and design.",
        title: "Similarity",
      },
      id: {
        description:
          "Membaca sudut, perbandingan sisi, dan faktor skala pada bangun, peta, dan desain.",
        title: "Kesebangunan",
      },
    },
    sections: [
      {
        slug: "angle-relationships",
        translations: {
          en: {
            title: "Angle Relationships",
          },
          id: {
            title: "Hubungan Antar Sudut",
          },
        },
      },
      {
        slug: "intersection-angles",
        translations: {
          en: {
            title: "Intersection Angles",
          },
          id: {
            title: "Besar Sudut Persimpangan",
          },
        },
      },
      {
        slug: "meaning-of-similarity",
        translations: {
          en: {
            title: "Meaning of Similarity",
          },
          id: {
            title: "Arti Kesebangunan",
          },
        },
      },
      {
        slug: "enlargement-and-reduction",
        translations: {
          en: {
            title: "Enlargement and Reduction",
          },
          id: {
            title: "Memperbesar dan Memperkecil",
          },
        },
      },
      {
        slug: "triangle-similarity",
        translations: {
          en: {
            title: "Triangle Similarity",
          },
          id: {
            title: "Kesebangunan pada Segitiga",
          },
        },
      },
      {
        slug: "proportional-scaling",
        translations: {
          en: {
            title: "Proportional Scaling",
          },
          id: {
            title: "Memperbesar dan Memperkecil secara Proporsional",
          },
        },
      },
    ],
  });
