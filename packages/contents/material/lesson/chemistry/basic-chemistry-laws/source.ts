import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonChemistryBasicChemistryLawsMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/chemistry/basic-chemistry-laws",
  domain: "chemistry",
  key: "lesson.chemistry.basic-chemistry-laws",
  kind: "lesson",
  slug: "basic-chemistry-laws",
  translations: {
    en: {
      description:
        "Learn how to distinguish chemical changes from physical changes using gas, precipitates, color changes, and energy changes.",
      title: "Basic Laws of Chemistry",
    },
    id: {
      description:
        "Pelajari cara membedakan perubahan kimia dari perubahan fisika lewat gas, endapan, perubahan warna, dan perubahan energi.",
      title: "Hukum Dasar Kimia",
    },
  },
  sections: [
    {
      slug: "chemical-reaction-characteristics",
      translations: {
        en: {
          title: "Characteristics of Chemical Reactions",
        },
        id: {
          title: "Ciri-Ciri Reaksi Kimia",
        },
      },
    },
    {
      slug: "chemistry-law-applications",
      translations: {
        en: {
          title: "Law Applications",
        },
        id: {
          title: "Aplikasi Hukum Kimia",
        },
      },
    },
    {
      slug: "combining-volumes-law",
      translations: {
        en: {
          title: "Combining Volumes",
        },
        id: {
          title: "Hukum Perbandingan Volume",
        },
      },
    },
    {
      slug: "constant-composition-law",
      translations: {
        en: {
          title: "Constant Composition",
        },
        id: {
          title: "Hukum Perbandingan Tetap",
        },
      },
    },
    {
      slug: "mass-conservation-law",
      translations: {
        en: {
          title: "Mass Conservation",
        },
        id: {
          title: "Hukum Kekekalan Massa",
        },
      },
    },
    {
      slug: "multiple-proportions-law",
      translations: {
        en: {
          title: "Multiple Proportions",
        },
        id: {
          title: "Hukum Perbandingan Berganda",
        },
      },
    },
    {
      slug: "types-chemical-reaction",
      translations: {
        en: {
          title: "Types of Chemical Reactions",
        },
        id: {
          title: "Jenis Reaksi Kimia",
        },
      },
    },
    {
      slug: "writing-chemical-reactions",
      translations: {
        en: {
          title: "Writing Chemical Reactions",
        },
        id: {
          title: "Cara Menuliskan Reaksi Kimia",
        },
      },
    },
  ],
});
