import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsRenewableEnergyMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/renewable-energy",
  domain: "physics",
  key: "lesson.physics.renewable-energy",
  kind: "lesson",
  slug: "renewable-energy",
  translations: {
    en: {
      description:
        "Learn what energy means in physics, how energy relates to work, joules, power, and how to read kWh in everyday electricity use.",
      title: "Renewable Energy",
    },
    id: {
      description:
        "Pelajari arti energi dalam fisika, hubungan energi dengan usaha, satuan joule, daya, dan cara membaca kWh pada pemakaian listrik sehari-hari.",
      title: "Energi Terbarukan",
    },
  },
  sections: [
    {
      slug: "energy",
      translations: {
        en: {
          title: "Energy Concept",
        },
        id: {
          title: "Energi",
        },
      },
    },
    {
      slug: "energy-conservation",
      translations: {
        en: {
          title: "Law of Energy Conservation",
        },
        id: {
          title: "Hukum Kekekalan Energi",
        },
      },
    },
    {
      slug: "energy-forms",
      translations: {
        en: {
          title: "Forms of Energy",
        },
        id: {
          title: "Bentuk-bentuk Energi",
        },
      },
    },
    {
      slug: "energy-impact",
      translations: {
        en: {
          title: "Impact of Energy Exploration and Use",
        },
        id: {
          title: "Dampak Eksplorasi dan Penggunaan Energi",
        },
      },
    },
    {
      slug: "energy-solutions",
      translations: {
        en: {
          title: "Solutions to Meet Energy Demands",
        },
        id: {
          title: "Upaya Pemenuhan Kebutuhan Energi",
        },
      },
    },
    {
      slug: "energy-sources",
      translations: {
        en: {
          title: "Energy Sources",
        },
        id: {
          title: "Sumber Energi",
        },
      },
    },
    {
      slug: "energy-transformation",
      translations: {
        en: {
          title: "Energy Transformation",
        },
        id: {
          title: "Konversi Energi",
        },
      },
    },
    {
      slug: "energy-urgency",
      translations: {
        en: {
          title: "Urgency of Energy Demand Issues",
        },
        id: {
          title: "Urgensi Isu Kebutuhan Energi",
        },
      },
    },
    {
      slug: "non-renewable-sources",
      translations: {
        en: {
          title: "Non-renewable Energy Sources",
        },
        id: {
          title: "Sumber Energi Tak Terbarukan",
        },
      },
    },
    {
      slug: "renewable-sources",
      translations: {
        en: {
          title: "Renewable Energy Sources",
        },
        id: {
          title: "Sumber Energi Terbarukan",
        },
      },
    },
  ],
});
