import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool12ChemistryFunctionalGroupCarbonCompoundTopic =
  defineSubjectMaterialTopic({
    slug: "functional-group-carbon-compound",
    translations: {
      en: {
        description:
          "Building blocks of organic molecules creating drugs, perfumes, and synthetic materials.",
        title: "Functional Groups in Carbon Compounds",
      },
      id: {
        description:
          "Blok bangunan molekul organik yang menciptakan obat, parfum, dan bahan sintetis.",
        title: "Gugus Fungsi dalam Senyawa Karbon",
      },
    },
    sections: [
      {
        slug: "carbon-chain-compound",
        translations: {
          en: {
            title: "Organic Compounds Composed of Carbon Chains",
          },
          id: {
            title: "Senyawa Organik Tersusun atas Rantai Karbon",
          },
        },
      },
      {
        slug: "functional-group-active-center",
        translations: {
          en: {
            title: "Functional Groups as Active Centers in Organic Compounds",
          },
          id: {
            title: "Gugus Fungsi sebagai Pusat Aktif pada Senyawa Organik",
          },
        },
      },
      {
        slug: "naming-organic-compound",
        translations: {
          en: {
            title: "Nomenclature of Organic Compounds",
          },
          id: {
            title: "Tata Nama Senyawa Organik",
          },
        },
      },
      {
        slug: "specific-reactions-functional-group",
        translations: {
          en: {
            title: "Specific Reactions of Functional Groups",
          },
          id: {
            title: "Reaksi-Reaksi Spesifik pada Gugus Fungsi",
          },
        },
      },
      {
        slug: "important-organic-compounds",
        translations: {
          en: {
            title: "Important Organic Compounds and Their Benefits",
          },
          id: {
            title: "Beberapa Senyawa Organik Penting dan Manfaatnya",
          },
        },
      },
    ],
  });
