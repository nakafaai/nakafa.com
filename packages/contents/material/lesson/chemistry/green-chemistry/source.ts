import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonChemistryGreenChemistryMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/chemistry/green-chemistry",
  domain: "chemistry",
  key: "lesson.chemistry.green-chemistry",
  kind: "lesson",
  slug: "green-chemistry",
  translations: {
    en: {
      description:
        "Read everyday chemical processes through atoms, elements, molecules, reaction equations, then judge whether the process fits green chemistry principles.",
      title: "Green Chemistry",
    },
    id: {
      description:
        "Baca proses kimia di sekitar kita dari atom, unsur, molekul, persamaan reaksi, lalu cek apakah prosesnya selaras dengan prinsip kimia hijau.",
      title: "Kimia Hijau",
    },
  },
  sections: [
    {
      slug: "chemical-processes-daily-life",
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
