import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11EconomyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/11/economy",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.economy",
  material: "economy",
  topics: [
    {
      slug: "business-economy",
      translations: {
        en: {
          description:
            "Powerful organizations that drive economic growth and create jobs worldwide.",
          title: "Business Entities in Economy",
        },
        id: {
          description:
            "Organisasi berkuasa yang mendorong pertumbuhan ekonomi dan menciptakan lapangan kerja.",
          title: "Badan Usaha dalam Perekonomian",
        },
      },
      sections: [
        {
          slug: "concept-enterprise",
          translations: {
            en: {
              title: "Concept of Business Entity",
            },
            id: {
              title: "Konsep Badan Usaha",
            },
          },
        },
        {
          slug: "state-owned-enterprise",
          translations: {
            en: {
              title: "State-Owned Enterprises",
            },
            id: {
              title: "Badan Usaha Milik Negara",
            },
          },
        },
        {
          slug: "local-government-enterprise",
          translations: {
            en: {
              title: "Local Government Enterprises",
            },
            id: {
              title: "Badan Usaha Milik Daerah",
            },
          },
        },
        {
          slug: "private-enterprise",
          translations: {
            en: {
              title: "Private Enterprises",
            },
            id: {
              title: "Badan Usaha Milik Swasta",
            },
          },
        },
        {
          slug: "cooperative",
          translations: {
            en: {
              title: "Cooperatives",
            },
            id: {
              title: "Koperasi",
            },
          },
        },
        {
          slug: "management",
          translations: {
            en: {
              title: "Management",
            },
            id: {
              title: "Manajemen",
            },
          },
        },
      ],
    },
    {
      slug: "national-income-inequality",
      translations: {
        en: {
          description:
            "Measuring a nation's wealth and understanding why some prosper while others struggle.",
          title: "National Income and Economic Inequality",
        },
        id: {
          description:
            "Mengukur kekayaan bangsa dan memahami mengapa ada yang makmur dan ada yang miskin.",
          title: "Pendapatan Nasional dan Kesenjangan Ekonomi",
        },
      },
      sections: [
        {
          slug: "national-income",
          translations: {
            en: {
              title: "National Income",
            },
            id: {
              title: "Pendapatan Nasional",
            },
          },
        },
        {
          slug: "economic-inequality",
          translations: {
            en: {
              title: "Economic Inequality",
            },
            id: {
              title: "Kesenjangan Ekonomi",
            },
          },
        },
      ],
    },
    {
      slug: "employment",
      translations: {
        en: {
          description:
            "The lifeline connecting people to income, purpose, and economic stability.",
          title: "Employment",
        },
        id: {
          description:
            "Jembatan vital yang menghubungkan manusia dengan pendapatan dan stabilitas ekonomi.",
          title: "Ketenagakerjaan",
        },
      },
      sections: [
        {
          slug: "concept",
          translations: {
            en: {
              title: "Employment Concepts",
            },
            id: {
              title: "Konsep Ketenagakerjaan",
            },
          },
        },
        {
          slug: "wage-system",
          translations: {
            en: {
              title: "Wage System",
            },
            id: {
              title: "Sistem Upah",
            },
          },
        },
        {
          slug: "unemployment",
          translations: {
            en: {
              title: "Unemployment",
            },
            id: {
              title: "Pengangguran",
            },
          },
        },
      ],
    },
    {
      slug: "money-price-inflation",
      translations: {
        en: {
          description:
            "Forces that determine what your money can buy today versus tomorrow.",
          title: "Money Theory, Price Index and Inflation",
        },
        id: {
          description:
            "Kekuatan yang menentukan daya beli uang Anda hari ini versus besok.",
          title: "Teori Uang, Indeks Harga dan Inflasi",
        },
      },
      sections: [
        {
          slug: "demand-supply-money",
          translations: {
            en: {
              title: "Money Demand and Supply",
            },
            id: {
              title: "Permintaan dan Penawaran Uang",
            },
          },
        },
        {
          slug: "price-index",
          translations: {
            en: {
              title: "Price Index",
            },
            id: {
              title: "Indeks Harga",
            },
          },
        },
        {
          slug: "inflation",
          translations: {
            en: {
              title: "Inflation",
            },
            id: {
              title: "Inflasi",
            },
          },
        },
      ],
    },
    {
      slug: "monetary-fiscal-policy",
      translations: {
        en: {
          description:
            "How monetary and fiscal policy influence prices, growth, and economic stability.",
          title: "Monetary and Fiscal Policy",
        },
        id: {
          description:
            "Toolkit ekonomi pemerintah untuk mengarahkan bangsa melalui kemakmuran dan krisis.",
          title: "Kebijakan Moneter dan Kebijakan Fiskal",
        },
      },
      sections: [
        {
          slug: "monetary-policy",
          translations: {
            en: {
              title: "Monetary Policy",
            },
            id: {
              title: "Kebijakan Moneter",
            },
          },
        },
        {
          slug: "fiscal-policy",
          translations: {
            en: {
              title: "Fiscal Policy",
            },
            id: {
              title: "Kebijakan Fiskal",
            },
          },
        },
        {
          slug: "benefits-impacts",
          translations: {
            en: {
              title: "Benefits and Impacts of Economic Policy",
            },
            id: {
              title: "Manfaat dan Dampak Kebijakan Ekonomi",
            },
          },
        },
        {
          slug: "evaluation",
          translations: {
            en: {
              title: "Economic Policy Evaluation",
            },
            id: {
              title: "Evaluasi Kebijakan Ekonomi",
            },
          },
        },
      ],
    },
  ],
});
