import { defineSubjectMaterial } from "@repo/contents/_types/material/schema";

export const subjectHighSchool10PhysicsMaterial = defineSubjectMaterial({
  baseRoute: "subject/high-school/10/physics",
  category: "high-school",
  grade: "10",
  kind: "subject",
  key: "subject.high-school.10.physics",
  material: "physics",
  topics: [
    {
      slug: "measurement",
      translations: {
        en: {
          description:
            "The foundation of all scientific discoveries and modern technology through precise measurement.",
          title: "Measurement in Scientific Work",
        },
        id: {
          description:
            "Fondasi semua penemuan sains dan teknologi modern melalui pengukuran yang akurat.",
          title: "Pengukuran dalam Kerja Ilmiah",
        },
      },
      sections: [
        {
          slug: "tools",
          translations: {
            en: {
              title: "Types of Measurement Tools",
            },
            id: {
              title: "Macam-macam Alat Ukur",
            },
          },
        },
        {
          slug: "quantity",
          translations: {
            en: {
              title: "Physical Quantities",
            },
            id: {
              title: "Besaran",
            },
          },
        },
        {
          slug: "unit",
          translations: {
            en: {
              title: "Unit Systems",
            },
            id: {
              title: "Sistem Satuan",
            },
          },
        },
        {
          slug: "dimension",
          translations: {
            en: {
              title: "Dimensions",
            },
            id: {
              title: "Dimensi",
            },
          },
        },
        {
          slug: "significant-figures",
          translations: {
            en: {
              title: "Significant Figures Rules",
            },
            id: {
              title: "Aturan Angka Penting",
            },
          },
        },
        {
          slug: "notation",
          translations: {
            en: {
              title: "Scientific Notation",
            },
            id: {
              title: "Notasi Ilmiah",
            },
          },
        },
        {
          slug: "uncertainty",
          translations: {
            en: {
              title: "Uncertainty in Repeated Measurements",
            },
            id: {
              title: "Nilai Ketidakpastian pada Pengukuran Berulang",
            },
          },
        },
      ],
    },
    {
      slug: "renewable-energy",
      translations: {
        en: {
          description:
            "Read the future of clean electricity through sunlight, wind, water, geothermal heat, and responsible energy choices.",
          title: "Renewable Energy",
        },
        id: {
          description:
            "Membaca masa depan listrik bersih dari Matahari, angin, air, panas bumi, dan keputusan energi yang bertanggung jawab.",
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
      ],
    },
  ],
});
