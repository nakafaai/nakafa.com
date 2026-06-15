import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectMiddleSchool8MathematicsStraightLineEquationsTopic =
  defineSubjectMaterialTopic({
    slug: "straight-line-equations",
    translations: {
      en: {
        description:
          "Read line graphs, slopes, points, and line equations on the coordinate plane.",
        title: "Straight Line Equations",
      },
      id: {
        description:
          "Membaca grafik garis, kemiringan, titik, dan persamaan garis pada bidang koordinat.",
        title: "Persamaan Garis Lurus",
      },
    },
    sections: [
      {
        slug: "line-graph",
        translations: {
          en: {
            title: "Graphing Straight Lines",
          },
          id: {
            title: "Grafik Persamaan Garis Lurus",
          },
        },
      },
      {
        slug: "slope-definition",
        translations: {
          en: {
            title: "Slope Definition",
          },
          id: {
            title: "Pengertian Kemiringan",
          },
        },
      },
      {
        slug: "finding-slope",
        translations: {
          en: {
            title: "Finding Slope",
          },
          id: {
            title: "Mencari Kemiringan",
          },
        },
      },
      {
        slug: "finding-equation",
        translations: {
          en: {
            title: "Finding Equation from Slope and Point",
          },
          id: {
            title: "Mencari Persamaan Garis dari Kemiringan dan Titik",
          },
        },
      },
    ],
  });
