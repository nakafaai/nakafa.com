import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11BiologyReproductionHormoneTopic =
  defineSubjectMaterialTopic({
    slug: "reproduction-hormone",
    translations: {
      en: {
        description:
          "Chemical messengers controlling sexual development and human reproductive cycles.",
        title: "Hormones in Human Reproduction",
      },
      id: {
        description:
          "Pesan kimia yang mengendalikan perkembangan seksual dan siklus reproduksi manusia.",
        title: "Hormon dalam Reproduksi Manusia",
      },
    },
    sections: [
      {
        slug: "endocrine-gland",
        translations: {
          en: {
            title: "Endocrine Gland Structure",
          },
          id: {
            title: "Struktur Kelenjar Endokrin",
          },
        },
      },
      {
        slug: "endocrine-gland-function",
        translations: {
          en: {
            title: "Endocrine Gland Function",
          },
          id: {
            title: "Fungsi Kelenjar Endokrin",
          },
        },
      },
      {
        slug: "hormone-function",
        translations: {
          en: {
            title: "Role of Hormones in Reproduction",
          },
          id: {
            title: "Peran Hormon dalam Reproduksi",
          },
        },
      },
      {
        slug: "organ-relationship",
        translations: {
          en: {
            title: "Relationship of Organ Structure in Reproductive System",
          },
          id: {
            title: "Keterkaitan Struktur Organ pada Sistem Reproduksi",
          },
        },
      },
    ],
  });
