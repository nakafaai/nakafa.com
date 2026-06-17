import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonBiologyBiodiversityMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/biology/biodiversity",
  domain: "biology",
  key: "lesson.biology.biodiversity",
  kind: "lesson",
  slug: "biodiversity",
  routeSlugs: { en: "biodiversity", id: "keanekaragaman-makhluk-hidup" },
  translations: {
    en: {
      description: "Connect bacterial shapes and parts to life roles.",
      title: "Biodiversity of Living Organisms",
    },
    id: {
      description: "Kenali bentuk bakteri dan perannya dalam hidup.",
      title: "Keanekaragaman Makhluk Hidup",
    },
  },
  sections: [
    {
      slug: "bacteria",
      routeSlugs: { en: "bacteria", id: "bakteri" },
      translations: {
        en: {
          title: "Bacteria",
        },
        id: {
          title: "Bakteri",
        },
      },
    },
    {
      slug: "classification",
      routeSlugs: { en: "classification", id: "klasifikasi-makhluk-hidup" },
      translations: {
        en: {
          title: "Classification of Living Organisms",
        },
        id: {
          title: "Klasifikasi Makhluk Hidup",
        },
      },
    },
    {
      slug: "fungi",
      routeSlugs: { en: "fungi", id: "fungi" },
      translations: {
        en: {
          title: "Fungi",
        },
        id: {
          title: "Fungi",
        },
      },
    },
    {
      slug: "levels",
      routeSlugs: { en: "levels", id: "keanekaragaman-hayati" },
      translations: {
        en: {
          title: "Biological Diversity",
        },
        id: {
          title: "Keanekaragaman Hayati",
        },
      },
    },
    {
      slug: "living-organisms",
      routeSlugs: {
        en: "living-organisms",
        id: "makhluk-hidup-dalam-ekosistem",
      },
      translations: {
        en: {
          title: "Living Organisms in Ecosystems",
        },
        id: {
          title: "Makhluk Hidup dalam Ekosistem",
        },
      },
    },
  ],
});
