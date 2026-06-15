import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectMiddleSchool8MathematicsPythagoreanTheoremTopic =
  defineSubjectMaterialTopic({
    slug: "pythagorean-theorem",
    translations: {
      en: {
        description:
          "Connect right-triangle side lengths, the converse theorem, distance, and applications.",
        title: "Pythagorean Theorem",
      },
      id: {
        description:
          "Menghubungkan sisi segitiga siku-siku, kebalikan Pythagoras, jarak, dan penerapannya.",
        title: "Teorema Pythagoras",
      },
    },
    sections: [
      {
        slug: "concept",
        translations: {
          en: {
            title: "Discovering Pythagorean Concept",
          },
          id: {
            title: "Menemukan Konsep Pythagoras",
          },
        },
      },
      {
        slug: "right-triangle",
        translations: {
          en: {
            title: "Right-Angled Triangles",
          },
          id: {
            title: "Segitiga Siku-Siku",
          },
        },
      },
      {
        slug: "theorem",
        translations: {
          en: {
            title: "Pythagorean Theorem",
          },
          id: {
            title: "Teorema Pythagoras",
          },
        },
      },
      {
        slug: "converse",
        translations: {
          en: {
            title: "Converse of Pythagorean Theorem",
          },
          id: {
            title: "Kebalikan Teorema Pythagoras",
          },
        },
      },
      {
        slug: "special-triangles",
        translations: {
          en: {
            title: "Special Triangles",
          },
          id: {
            title: "Segitiga Istimewa",
          },
        },
      },
      {
        slug: "applications",
        translations: {
          en: {
            title: "Applications of Pythagorean Theorem",
          },
          id: {
            title: "Penerapan Teorema Pythagoras",
          },
        },
      },
      {
        slug: "distance",
        translations: {
          en: {
            title: "Distance Formula",
          },
          id: {
            title: "Rumus Jarak",
          },
        },
      },
    ],
  });
