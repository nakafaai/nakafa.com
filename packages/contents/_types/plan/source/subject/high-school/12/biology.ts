import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12BiologyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/12/biology",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.biology",
  material: "biology",
  topics: [
    {
      slug: "enzyme-metabolism",
      translations: {
        en: {
          description:
            "Biological catalysts driving all life reactions from digestion to respiration.",
          title: "Enzymes and Metabolism",
        },
        id: {
          description:
            "Katalis biologis yang menggerakkan semua reaksi kehidupan dari pencernaan hingga respirasi.",
          title: "Enzim dan Metabolisme",
        },
      },
      sections: [
        {
          slug: "enzyme",
          translations: {
            en: {
              title: "Enzymes",
            },
            id: {
              title: "Enzim",
            },
          },
        },
        {
          slug: "metabolism",
          translations: {
            en: {
              title: "Metabolism",
            },
            id: {
              title: "Metabolisme",
            },
          },
        },
      ],
    },
    {
      slug: "genetic-inheritance",
      translations: {
        en: {
          description:
            "Life's code determining eye color, height, and all hereditary traits.",
          title: "Genetics and Inheritance",
        },
        id: {
          description:
            "Kode kehidupan yang menentukan warna mata, tinggi badan, dan semua sifat turunan.",
          title: "Genetik dan Pewarisan Sifat",
        },
      },
      sections: [
        {
          slug: "genetic-material",
          translations: {
            en: {
              title: "Genetic Material",
            },
            id: {
              title: "Materi Genetik",
            },
          },
        },
        {
          slug: "protein-synthesis",
          translations: {
            en: {
              title: "Protein Synthesis",
            },
            id: {
              title: "Sintesis Protein",
            },
          },
        },
        {
          slug: "cell-division",
          translations: {
            en: {
              title: "Cell Division",
            },
            id: {
              title: "Pembelahan Sel",
            },
          },
        },
        {
          slug: "inheritance",
          translations: {
            en: {
              title: "Inheritance",
            },
            id: {
              title: "Pewarisan Sifat",
            },
          },
        },
      ],
    },
    {
      slug: "evolution",
      translations: {
        en: {
          description:
            "Spectacular journey of life from simple organisms to modern diversity.",
          title: "Evolution",
        },
        id: {
          description:
            "Perjalanan spektakuler kehidupan dari organisme sederhana hingga keanekaragaman modern.",
          title: "Evolusi",
        },
      },
      sections: [
        {
          slug: "definition",
          translations: {
            en: {
              title: "Definition of Evolution",
            },
            id: {
              title: "Definisi Evolusi",
            },
          },
        },
        {
          slug: "development-theory",
          translations: {
            en: {
              title: "Development of Evolution Theory",
            },
            id: {
              title: "Perkembangan Teori Evolusi",
            },
          },
        },
      ],
    },
    {
      slug: "biotechnology-innovation",
      translations: {
        en: {
          description:
            "Scientific revolution producing medicines, vaccines, and future solutions.",
          title: "Biotechnology Innovation",
        },
        id: {
          description:
            "Revolusi sains yang menghasilkan obat-obatan, vaksin, dan solusi masa depan.",
          title: "Inovasi Bioteknologi",
        },
      },
      sections: [
        {
          slug: "definition",
          translations: {
            en: {
              title: "Definition of Biotechnology",
            },
            id: {
              title: "Definisi Bioteknologi",
            },
          },
        },
        {
          slug: "benefit",
          translations: {
            en: {
              title: "Benefits of Biotechnology",
            },
            id: {
              title: "Manfaat Bioteknologi",
            },
          },
        },
        {
          slug: "type",
          translations: {
            en: {
              title: "Types of Biotechnology",
            },
            id: {
              title: "Jenis Bioteknologi",
            },
          },
        },
        {
          slug: "branch",
          translations: {
            en: {
              title: "Scientific Branches in Biotechnology",
            },
            id: {
              title: "Cabang Ilmu yang Berperan dalam Bioteknologi",
            },
          },
        },
        {
          slug: "conventional-application",
          translations: {
            en: {
              title: "Conventional Biotechnology Applications",
            },
            id: {
              title: "Aplikasi Bioteknologi Konvensional",
            },
          },
        },
        {
          slug: "modern-application",
          translations: {
            en: {
              title: "Modern Biotechnology Applications",
            },
            id: {
              title: "Aplikasi Bioteknologi Modern",
            },
          },
        },
        {
          slug: "modern-reality",
          translations: {
            en: {
              title: "Expectations and Reality of Modern Biotechnology",
            },
            id: {
              title: "Harapan dan Kenyataan Bioteknologi Modern",
            },
          },
        },
        {
          slug: "bioethics",
          translations: {
            en: {
              title: "Bioethics",
            },
            id: {
              title: "Bioetika",
            },
          },
        },
      ],
    },
  ],
});
