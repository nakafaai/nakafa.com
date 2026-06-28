import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonChemistryGreenChemistryMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/chemistry/green-chemistry",
  domain: "chemistry",
  key: "lesson.chemistry.green-chemistry",
  kind: "lesson",
  slug: "green-chemistry",
  routeSlugs: { en: "green-chemistry", id: "kimia-hijau" },
  translations: {
    en: {
      description: "Judge everyday reactions through green chemistry ideas.",
      title: "Green Chemistry",
    },
    id: {
      description: "Nilai reaksi sehari-hari dengan prinsip kimia hijau.",
      title: "Kimia Hijau",
    },
  },
  sections: [
    {
      slug: "chemical-processes-daily-life",
      routeSlugs: {
        en: "chemical-processes-daily-life",
        id: "proses-kimia-sehari-hari",
      },
      translations: {
        en: {
          title: "Daily Chemical Processes",
        },
        id: {
          title: "Proses Kimia Sehari-hari",
        },
      },
    },
    {
      slug: "definition",
      routeSlugs: { en: "definition", id: "pengertian-kimia-hijau" },
      translations: {
        en: {
          title: "Definition of Green Chemistry",
        },
        id: {
          title: "Pengertian Kimia Hijau",
        },
      },
    },
    {
      slug: "green-chemistry-activities",
      routeSlugs: {
        en: "green-chemistry-activities",
        id: "kegiatan-kimia-hijau",
      },
      translations: {
        en: {
          title: "Green Chemistry Activities",
        },
        id: {
          title: "Kegiatan Kimia Hijau",
        },
      },
    },
    {
      slug: "principles",
      routeSlugs: { en: "principles", id: "prinsip-kimia-hijau" },
      translations: {
        en: {
          title: "Green Chemistry Principles",
        },
        id: {
          title: "Prinsip Kimia Hijau",
        },
      },
    },
  ],
});
