import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsMeasurementMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/measurement",
  domain: "physics",
  key: "lesson.physics.measurement",
  kind: "lesson",
  slug: "measurement",
  translations: {
    en: {
      description:
        "Learn physical dimensions as codes built from base quantities, how to derive dimensions of derived quantities, and how to check formulas without numbers.",
      title: "Measurement in Scientific Work",
    },
    id: {
      description:
        "Pelajari dimensi fisika sebagai kode penyusun besaran pokok, cara menurunkan dimensi besaran turunan, dan cara mengecek rumus tanpa angka.",
      title: "Pengukuran dalam Kerja Ilmiah",
    },
  },
  sections: [
    {
      slug: "dimension",
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
