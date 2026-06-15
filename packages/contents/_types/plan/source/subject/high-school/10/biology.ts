import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool10BiologyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/10/biology",
  category: "high-school",
  grade: "10",
  kind: "subject",
  key: "subject.high-school.10.biology",
  material: "biology",
  topics: [
    {
      slug: "virus-role",
      translations: {
        en: {
          description:
            "Virus structure, replication, roles, and prevention across cells, bodies, and environments.",
          title: "Viruses and Their Role",
        },
        id: {
          description:
            "Struktur, replikasi, peran, dan pencegahan virus dalam konteks sel, tubuh, dan lingkungan.",
          title: "Virus dan Peranannya",
        },
      },
      sections: [
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
      ],
    },
    {
      slug: "biodiversity",
      translations: {
        en: {
          description:
            "Biodiversity levels, classification, bacteria, fungi, and organism relationships in ecosystems.",
          title: "Biodiversity of Living Organisms",
        },
        id: {
          description:
            "Tingkat biodiversitas, klasifikasi, bakteri, fungi, dan hubungan organisme dalam ekosistem.",
          title: "Keanekaragaman Makhluk Hidup",
        },
      },
      sections: [
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
    },
    {
      slug: "climate-change",
      translations: {
        en: {
          description:
            "Climate symptoms, impacts, causes, mitigation, adaptation, and data-backed cooperation.",
          title: "Climate Change",
        },
        id: {
          description:
            "Gejala, dampak, penyebab, mitigasi, adaptasi, dan kerja sama iklim berbasis data.",
          title: "Perubahan Iklim",
        },
      },
      sections: [
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
      ],
    },
  ],
});
