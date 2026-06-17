import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsMeasurementMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/measurement",
  domain: "physics",
  key: "lesson.physics.measurement",
  kind: "lesson",
  slug: "measurement",
  routeSlugs: { en: "measurement", id: "pengukuran-dalam-kerja-ilmiah" },
  translations: {
    en: {
      description: "Use dimensions to check quantities and formulas.",
      title: "Measurement in Scientific Work",
    },
    id: {
      description: "Gunakan dimensi untuk mengecek besaran dan rumus.",
      title: "Pengukuran dalam Kerja Ilmiah",
    },
  },
  sections: [
    {
      slug: "dimension",
      routeSlugs: { en: "dimension", id: "dimensi" },
      translations: {
        en: {
          title: "Dimensions",
        },
        id: {
          title: "Dimensi",
        },
      },
    },
    {
      slug: "notation",
      routeSlugs: { en: "notation", id: "notasi-ilmiah" },
      translations: {
        en: {
          title: "Scientific Notation",
        },
        id: {
          title: "Notasi Ilmiah",
        },
      },
    },
    {
      slug: "quantity",
      routeSlugs: { en: "quantity", id: "besaran" },
      translations: {
        en: {
          title: "Physical Quantities",
        },
        id: {
          title: "Besaran",
        },
      },
    },
    {
      slug: "significant-figures",
      routeSlugs: { en: "significant-figures", id: "aturan-angka-penting" },
      translations: {
        en: {
          title: "Significant Figures Rules",
        },
        id: {
          title: "Aturan Angka Penting",
        },
      },
    },
    {
      slug: "tools",
      routeSlugs: { en: "tools", id: "macam-macam-alat-ukur" },
      translations: {
        en: {
          title: "Types of Measurement Tools",
        },
        id: {
          title: "Macam-macam Alat Ukur",
        },
      },
    },
    {
      slug: "uncertainty",
      routeSlugs: {
        en: "uncertainty",
        id: "nilai-ketidakpastian-pada-pengukuran-berulang",
      },
      translations: {
        en: {
          title: "Uncertainty in Repeated Measurements",
        },
        id: {
          title: "Nilai Ketidakpastian pada Pengukuran Berulang",
        },
      },
    },
    {
      slug: "unit",
      routeSlugs: { en: "unit", id: "sistem-satuan" },
      translations: {
        en: {
          title: "Unit Systems",
        },
        id: {
          title: "Sistem Satuan",
        },
      },
    },
  ],
});
