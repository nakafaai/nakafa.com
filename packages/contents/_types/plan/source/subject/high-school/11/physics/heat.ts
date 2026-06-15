import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11PhysicsHeatTopic = defineSubjectPlanTopic({
  slug: "heat",
  translations: {
    en: {
      description:
        "Hidden energy that powers engines and warms our homes every day.",
      title: "Heat",
    },
    id: {
      description:
        "Energi tersembunyi yang menggerakkan mesin dan menghangatkan rumah kita.",
      title: "Kalor",
    },
  },
  sections: [
    {
      slug: "temperature-measurement",
      translations: {
        en: {
          title: "Temperature Definition and Measurement Tools",
        },
        id: {
          title: "Pengertian Suhu dan Alat Ukurnya",
        },
      },
    },
    {
      slug: "temperature-scale",
      translations: {
        en: {
          title: "Temperature Scale",
        },
        id: {
          title: "Skala Suhu",
        },
      },
    },
    {
      slug: "heat-definition",
      translations: {
        en: {
          title: "Heat Definition",
        },
        id: {
          title: "Pengertian Kalor",
        },
      },
    },
    {
      slug: "heat-effect-temperature-change",
      translations: {
        en: {
          title: "Heat Effect on Temperature Change",
        },
        id: {
          title: "Pengaruh Kalor pada Perubahan Suhu",
        },
      },
    },
    {
      slug: "heat-effect-phase-change",
      translations: {
        en: {
          title: "Heat Effect on Phase Change",
        },
        id: {
          title: "Pengaruh Kalor pada Perubahan Wujud",
        },
      },
    },
    {
      slug: "heat-effect-expansion",
      translations: {
        en: {
          title: "Heat Effect on Expansion",
        },
        id: {
          title: "Pengaruh Kalor pada Pemuaian",
        },
      },
    },
    {
      slug: "conduction",
      translations: {
        en: {
          title: "Conduction",
        },
        id: {
          title: "Konduksi",
        },
      },
    },
    {
      slug: "convection",
      translations: {
        en: {
          title: "Convection",
        },
        id: {
          title: "Konveksi",
        },
      },
    },
    {
      slug: "radiation",
      translations: {
        en: {
          title: "Radiation",
        },
        id: {
          title: "Radiasi",
        },
      },
    },
    {
      slug: "heat-transfer-application",
      translations: {
        en: {
          title: "Heat Transfer Applications",
        },
        id: {
          title: "Aplikasi Perpindahan Kalor",
        },
      },
    },
  ],
});
