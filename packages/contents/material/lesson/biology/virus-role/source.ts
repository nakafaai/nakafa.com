import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonBiologyVirusRoleMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/biology/virus-role",
  domain: "biology",
  key: "lesson.biology.virus-role",
  kind: "lesson",
  slug: "virus-role",
  translations: {
    en: {
      description:
        "Understand viral replication through lytic and lysogenic cycles, from attachment to the release of new virus particles.",
      title: "Viruses and Their Role",
    },
    id: {
      description:
        "Memahami replikasi virus melalui siklus litik dan lisogenik, mulai dari penempelan sampai pelepasan partikel virus baru.",
      title: "Virus dan Peranannya",
    },
  },
  sections: [
    {
      slug: "how-virus-reproduce",
      translations: {
        en: {
          title: "How Do Viruses Reproduce?",
        },
        id: {
          title: "Bagaimana Virus Bereproduksi?",
        },
      },
    },
    {
      slug: "prevent-virus-spread",
      translations: {
        en: {
          title: "Ways to Prevent Virus Spread",
        },
        id: {
          title: "Cara Mencegah Penyebaran Virus",
        },
      },
    },
    {
      slug: "role",
      translations: {
        en: {
          title: "Role of Viruses",
        },
        id: {
          title: "Peranan Virus",
        },
      },
    },
    {
      slug: "what-is-virus",
      translations: {
        en: {
          title: "What is a Virus?",
        },
        id: {
          title: "Apa itu Virus?",
        },
      },
    },
  ],
});
