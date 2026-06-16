import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonBiologyClimateChangeMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/biology/climate-change",
  domain: "biology",
  key: "lesson.biology.climate-change",
  kind: "lesson",
  slug: "climate-change",
  translations: {
    en: {
      description:
        "Understand the greenhouse effect, greenhouse gases, fossil fuel combustion, land-use change, organic waste, plastic, and human activities that increase warming.",
      title: "Climate Change",
    },
    id: {
      description:
        "Memahami efek rumah kaca, gas rumah kaca, pembakaran bahan bakar fosil, perubahan lahan, limbah organik, plastik, dan aktivitas manusia yang meningkatkan pemanasan.",
      title: "Perubahan Iklim",
    },
  },
  sections: [
    {
      slug: "causes",
      translations: {
        en: {
          title: "Causes of Climate Change",
        },
        id: {
          title: "Penyebab Perubahan Iklim",
        },
      },
    },
    {
      slug: "global-cooperation",
      translations: {
        en: {
          title: "Global Cooperation to Address Climate Change",
        },
        id: {
          title: "Kerja Sama Global untuk Mengatasi Perubahan Iklim",
        },
      },
    },
    {
      slug: "impact",
      translations: {
        en: {
          title: "Impact of Climate Change",
        },
        id: {
          title: "Dampak Perubahan Iklim",
        },
      },
    },
    {
      slug: "mitigation-adaptation",
      translations: {
        en: {
          title: "Mitigation and Adaptation Efforts for Climate Change",
        },
        id: {
          title: "Upaya Mitigasi dan Adaptasi terhadap Perubahan Iklim",
        },
      },
    },
    {
      slug: "symptoms",
      translations: {
        en: {
          title: "Symptoms of Climate Change",
        },
        id: {
          title: "Gejala Perubahan Iklim",
        },
      },
    },
  ],
});
