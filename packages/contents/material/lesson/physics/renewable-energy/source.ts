import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonPhysicsRenewableEnergyMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/physics/renewable-energy",
  domain: "physics",
  key: "lesson.physics.renewable-energy",
  kind: "lesson",
  slug: "renewable-energy",
  routeSlugs: { en: "renewable-energy", id: "energi-terbarukan" },
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
      routeSlugs: { en: "energy", id: "energi" },
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
      routeSlugs: { en: "energy-conservation", id: "hukum-kekekalan-energi" },
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
      routeSlugs: { en: "energy-forms", id: "bentuk-bentuk-energi" },
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
      routeSlugs: {
        en: "energy-impact",
        id: "dampak-eksplorasi-dan-penggunaan-energi",
      },
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
      routeSlugs: {
        en: "energy-solutions",
        id: "upaya-pemenuhan-kebutuhan-energi",
      },
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
      routeSlugs: { en: "energy-sources", id: "sumber-energi" },
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
      routeSlugs: { en: "energy-transformation", id: "konversi-energi" },
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
      routeSlugs: { en: "energy-urgency", id: "urgensi-isu-kebutuhan-energi" },
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
      routeSlugs: {
        en: "non-renewable-sources",
        id: "sumber-energi-tak-terbarukan",
      },
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
      routeSlugs: { en: "renewable-sources", id: "sumber-energi-terbarukan" },
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
