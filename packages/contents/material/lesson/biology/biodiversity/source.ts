import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonBiologyBiodiversityMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/biology/biodiversity",
  domain: "biology",
  key: "lesson.biology.biodiversity",
  kind: "lesson",
  slug: "biodiversity",
  translations: {
    en: {
      description:
        "Recognize bacteria as prokaryotic cells with coccus, bacillus, spiral forms, nucleoids, ribosomes, cell walls, and roles in life.",
      title: "Biodiversity of Living Organisms",
    },
    id: {
      description:
        "Mengenali bakteri sebagai sel prokariotik dengan bentuk kokus, basilus, spiral, struktur nukleoid, ribosom, dinding sel, dan peran dalam kehidupan.",
      title: "Keanekaragaman Makhluk Hidup",
    },
  },
  sections: [
    {
      slug: "bacteria",
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
