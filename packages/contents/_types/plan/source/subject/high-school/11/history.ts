import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11HistoryPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/11/history",
  category: "high-school",
  grade: "11",
  kind: "subject",
  key: "subject.high-school.11.history",
  material: "history",
  topics: [
    {
      slug: "colonialism-resistance",
      translations: {
        en: {
          description:
            "Heroic struggle against colonizers that nurtured the nation's spirit of independence.",
          title: "Colonialism and Indonesian Resistance",
        },
        id: {
          description:
            "Perjuangan heroik melawan penjajah yang memupuk semangat kemerdekaan bangsa.",
          title: "Kolonialisme dan Perlawanan Bangsa Indonesia",
        },
      },
      sections: [
        {
          slug: "regional-global-history",
          translations: {
            en: {
              title:
                "Historical Connection between Regional and Global Situations",
            },
            id: {
              title: "Keterkaitan Sejarah antara Situasi Regional dan Global",
            },
          },
        },
        {
          slug: "indonesian-resistance",
          translations: {
            en: {
              title: "Indonesian Resistance Against Colonialism",
            },
            id: {
              title: "Perlawanan Bangsa Indonesia Terhadap Kolonialisme",
            },
          },
        },
        {
          slug: "impact-colonialism",
          translations: {
            en: {
              title: "Impact of Colonialism in Colonial Countries",
            },
            id: {
              title: "Dampak Penjajahan di Negara Koloni",
            },
          },
        },
      ],
    },
    {
      slug: "national-movement",
      translations: {
        en: {
          description:
            "Awakening of national consciousness uniting the archipelago in one shared dream.",
          title: "Indonesian National Movement",
        },
        id: {
          description:
            "Kebangkitan kesadaran nasional yang menyatukan nusantara dalam satu cita-cita.",
          title: "Pergerakan Kebangsaan Indonesia",
        },
      },
      sections: [
        {
          slug: "eastern-renaissance",
          translations: {
            en: {
              title: "Eastern Nations Renaissance",
            },
            id: {
              title: "Kebangkitan Bangsa Timur",
            },
          },
        },
        {
          slug: "nationalism-embrio",
          translations: {
            en: {
              title: "Emergence of Nationalism and National Identity",
            },
            id: {
              title: "Munculnya Embrio Kebangsaan dan Nasionalisme",
            },
          },
        },
        {
          slug: "end-colonialism",
          translations: {
            en: {
              title: "End of Dutch Colonial State",
            },
            id: {
              title: "Akhir Masa Negara Kolonial Belanda",
            },
          },
        },
      ],
    },
    {
      slug: "under-japanese-rule",
      translations: {
        en: {
          description:
            "Dark period that paradoxically accelerated Indonesia's path to independence.",
          title: "Under Japanese Tyranny",
        },
        id: {
          description:
            "Masa kelam yang paradoksnya mempercepat jalan menuju kemerdekaan Indonesia.",
          title: "Di Bawah Tirani Jepang",
        },
      },
      sections: [
        {
          slug: "japanese-dutch-fall",
          translations: {
            en: {
              title: "Japanese Entry and Fall of Dutch East Indies",
            },
            id: {
              title: "Masuknya Jepang dan Jatuhnya Hindia Belanda",
            },
          },
        },
        {
          slug: "japanese-transformation",
          translations: {
            en: {
              title:
                "Japanese Occupation and Government Transformation in Indonesia",
            },
            id: {
              title:
                "Penjajahan Jepang dan Transformasi Pemerintahan di Indonesia",
            },
          },
        },
        {
          slug: "japanese-impact",
          translations: {
            en: {
              title: "Impact of Japanese Occupation in Various Fields",
            },
            id: {
              title: "Dampak Penjajahan Jepang di Berbagai Bidang",
            },
          },
        },
        {
          slug: "indonesian-strategy",
          translations: {
            en: {
              title: "Indonesian Strategy Facing Japanese Tyranny",
            },
            id: {
              title: "Strategi Bangsa Indonesia Menghadapi Tirani Jepang",
            },
          },
        },
      ],
    },
    {
      slug: "proclamation-independence",
      translations: {
        en: {
          description:
            "Historic moment transforming a colonized nation into a free and sovereign state.",
          title: "Proclamation of Independence",
        },
        id: {
          description:
            "Momen bersejarah yang mengubah bangsa terjajah menjadi negara merdeka dan berdaulat.",
          title: "Proklamasi Kemerdekaan",
        },
      },
      sections: [
        {
          slug: "japanese-defeat",
          translations: {
            en: {
              title: "Japanese Defeat",
            },
            id: {
              title: "Kekalahan Jepang",
            },
          },
        },
        {
          slug: "towards-proclamation",
          translations: {
            en: {
              title: "Towards the Proclamation of Independence",
            },
            id: {
              title: "Menuju Proklamasi Kemerdekaan",
            },
          },
        },
        {
          slug: "proclamation-details",
          translations: {
            en: {
              title: "Moments of Proclamation",
            },
            id: {
              title: "Detik-Detik Proklamasi",
            },
          },
        },
        {
          slug: "reception",
          translations: {
            en: {
              title: "Reception of the Proclamation of Independence",
            },
            id: {
              title: "Sambutan terhadap Proklamasi Kemerdekaan",
            },
          },
        },
      ],
    },
  ],
});
