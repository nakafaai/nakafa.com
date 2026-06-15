import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12EconomyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/12/economy",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.economy",
  material: "economy",
  topics: [
    {
      slug: "growth-development",
      translations: {
        en: {
          description:
            "How economic growth, development, and the digital economy affect people's welfare.",
          title: "Economic Growth and Development",
        },
        id: {
          description:
            "Mesin pengubah masyarakat dari kemiskinan menuju kemakmuran di era digital.",
          title: "Pertumbuhan dan Pembangunan Ekonomi",
        },
      },
      sections: [
        {
          slug: "economic-growth",
          translations: {
            en: {
              title: "Economic Growth",
            },
            id: {
              title: "Pertumbuhan Ekonomi",
            },
          },
        },
        {
          slug: "economic-development",
          translations: {
            en: {
              title: "Economic Development",
            },
            id: {
              title: "Pembangunan Ekonomi",
            },
          },
        },
        {
          slug: "digital-economy",
          translations: {
            en: {
              title: "Digital Economy",
            },
            id: {
              title: "Ekonomi Digital",
            },
          },
        },
      ],
    },
    {
      slug: "international-economy",
      translations: {
        en: {
          description:
            "How trade, cooperation, and competition connect national economies.",
          title: "International Economy",
        },
        id: {
          description:
            "Jaring ekonomi global yang menghubungkan bangsa melalui perdagangan dan kerjasama.",
          title: "Ekonomi Internasional",
        },
      },
      sections: [
        {
          slug: "concept-trade",
          translations: {
            en: {
              title: "International Trade Concept",
            },
            id: {
              title: "Konsep Perdagangan Internasional",
            },
          },
        },
        {
          slug: "benefits-trade",
          translations: {
            en: {
              title: "Benefits of International Trade",
            },
            id: {
              title: "Manfaat Perdagangan Internasional",
            },
          },
        },
        {
          slug: "promoting-factors-trade",
          translations: {
            en: {
              title: "Promoting Factors of International Trade",
            },
            id: {
              title: "Faktor Pendorong Perdagangan Internasional",
            },
          },
        },
        {
          slug: "limiting-factors-trade",
          translations: {
            en: {
              title: "Limiting Factors of International Trade",
            },
            id: {
              title: "Faktor Penghambat Perdagangan Internasional",
            },
          },
        },
        {
          slug: "theory-trade",
          translations: {
            en: {
              title: "International Trade Theory",
            },
            id: {
              title: "Teori Perdagangan Internasional",
            },
          },
        },
        {
          slug: "policy-trade",
          translations: {
            en: {
              title: "International Trade Policy",
            },
            id: {
              title: "Kebijakan Perdagangan Internasional",
            },
          },
        },
        {
          slug: "balance-payment",
          translations: {
            en: {
              title: "Balance of Payments",
            },
            id: {
              title: "Neraca Pembayaran",
            },
          },
        },
        {
          slug: "economic-cooperation",
          translations: {
            en: {
              title: "International Economic Cooperation",
            },
            id: {
              title: "Kerja Sama Ekonomi Internasional",
            },
          },
        },
      ],
    },
    {
      slug: "apbn-apbd",
      translations: {
        en: {
          description:
            "How public budgets shape services, infrastructure, and priorities.",
          title: "State and Regional Budget",
        },
        id: {
          description:
            "Cetak biru keuangan yang menentukan layanan publik, infrastruktur, dan prioritas bangsa.",
          title: "APBN dan APBD",
        },
      },
      sections: [
        {
          slug: "apbn",
          translations: {
            en: {
              title: "State Budget (APBN)",
            },
            id: {
              title: "APBN",
            },
          },
        },
        {
          slug: "apbd",
          translations: {
            en: {
              title: "Regional Budget (APBD)",
            },
            id: {
              title: "APBD",
            },
          },
        },
        {
          slug: "taxation",
          translations: {
            en: {
              title: "Taxation",
            },
            id: {
              title: "Perpajakan",
            },
          },
        },
      ],
    },
    {
      slug: "accounting",
      translations: {
        en: {
          description:
            "How transactions are recorded, financial position is read, and reports support business decisions.",
          title: "Accounting",
        },
        id: {
          description:
            "Cara mencatat transaksi, membaca posisi keuangan, dan menyiapkan laporan untuk keputusan usaha.",
          title: "Akuntansi",
        },
      },
      sections: [
        {
          slug: "accounting-equation",
          translations: {
            en: {
              title: "Basic Accounting Equation",
            },
            id: {
              title: "Persamaan Dasar Akuntansi",
            },
          },
        },
        {
          slug: "financial-report",
          translations: {
            en: {
              title: "Financial Reports",
            },
            id: {
              title: "Laporan Keuangan",
            },
          },
        },
      ],
    },
  ],
});
