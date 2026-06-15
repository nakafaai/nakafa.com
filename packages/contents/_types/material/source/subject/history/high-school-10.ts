import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";

export const subjectHighSchool10HistoryMaterial = defineSubjectMaterial({
  baseRoute: "subject/high-school/10/history",
  category: "high-school",
  grade: "10",
  kind: "subject",
  key: "subject.high-school.10.history",
  material: "history",
  topics: [
    {
      slug: "history-introduction",
      translations: {
        en: {
          description:
            "Time journey revealing past secrets to understand the present moment.",
          title: "Introduction to Historical Studies",
        },
        id: {
          description:
            "Perjalanan waktu yang mengungkap rahasia masa lalu untuk memahami masa kini.",
          title: "Pengantar Ilmu Sejarah",
        },
      },
      sections: [
        {
          slug: "concept",
          translations: {
            en: {
              title: "Historical Concepts",
            },
            id: {
              title: "Konsep Sejarah",
            },
          },
        },
        {
          slug: "why-study-history",
          translations: {
            en: {
              title: "Why Do We Need to Study History?",
            },
            id: {
              title: "Mengapa Perlu Mempelajari Ilmu Sejarah?",
            },
          },
        },
        {
          slug: "human-space-time",
          translations: {
            en: {
              title: "Humans, Space, and Time in History",
            },
            id: {
              title: "Manusia, Ruang, dan Waktu dalam Sejarah",
            },
          },
        },
      ],
    },
    {
      slug: "history-research",
      translations: {
        en: {
          description:
            "Detective art of the past searching for truth from remaining traces.",
          title: "Historical Research",
        },
        id: {
          description:
            "Seni detektif masa lalu yang mencari kebenaran dari jejak-jejak yang tertinggal.",
          title: "Penelitian Sejarah",
        },
      },
      sections: [
        {
          slug: "primary-sources",
          translations: {
            en: {
              title: "Primary Historical Sources",
            },
            id: {
              title: "Sumber Sejarah Primer",
            },
          },
        },
        {
          slug: "secondary-sources",
          translations: {
            en: {
              title: "Secondary Historical Sources",
            },
            id: {
              title: "Sumber Sejarah Sekunder",
            },
          },
        },
      ],
    },
    {
      slug: "history-writing",
      translations: {
        en: {
          description:
            "Skill of narrating the past objectively and convincingly for future generations.",
          title: "Historical Writing",
        },
        id: {
          description:
            "Keahlian menceritakan masa lalu dengan objektif dan meyakinkan untuk generasi mendatang.",
          title: "Penulisan Sejarah",
        },
      },
      sections: [
        {
          slug: "historiography",
          translations: {
            en: {
              title: "What is Historiography?",
            },
            id: {
              title: "Apa itu Historiografi?",
            },
          },
        },
        {
          slug: "avoiding-bias",
          translations: {
            en: {
              title: "Avoiding Historical Bias",
            },
            id: {
              title: "Menghindari Bias Sejarah",
            },
          },
        },
        {
          slug: "how-history-research",
          translations: {
            en: {
              title: "How to Conduct Historical Research and Writing?",
            },
            id: {
              title: "Bagaimana melakukan Penelitian dan Penulisan Sejarah?",
            },
          },
        },
      ],
    },
  ],
});
