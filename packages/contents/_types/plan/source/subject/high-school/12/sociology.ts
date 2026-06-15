import { defineSubjectPlan } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12SociologyPlan = defineSubjectPlan({
  baseRoute: "subject/high-school/12/sociology",
  category: "high-school",
  grade: "12",
  kind: "subject",
  key: "subject.high-school.12.sociology",
  material: "sociology",
  topics: [
    {
      slug: "social-change",
      translations: {
        en: {
          description:
            "How societies change over time and how those changes affect daily life.",
          title: "Social Change",
        },
        id: {
          description:
            "Kekuatan tak terhindarkan yang mengubah cara hidup manusia dari masa ke masa.",
          title: "Perubahan Sosial",
        },
      },
      sections: [
        {
          slug: "understanding",
          translations: {
            en: {
              title: "Understanding Social Change",
            },
            id: {
              title: "Memahami Perubahan Sosial",
            },
          },
        },
        {
          slug: "theories",
          translations: {
            en: {
              title: "Social Change Theories",
            },
            id: {
              title: "Teori Perubahan Sosial",
            },
          },
        },
        {
          slug: "forms",
          translations: {
            en: {
              title: "Forms of Social Change",
            },
            id: {
              title: "Bentuk Perubahan Sosial",
            },
          },
        },
        {
          slug: "impact",
          translations: {
            en: {
              title: "Impact of Social Change",
            },
            id: {
              title: "Dampak Perubahan Sosial",
            },
          },
        },
      ],
    },
    {
      slug: "globalization-digital",
      translations: {
        en: {
          description:
            "How global connections and digital technology shape social life.",
          title: "Globalization and Digital Society",
        },
        id: {
          description:
            "Revolusi konektivitas yang menyatukan dunia dalam satu jaringan digital raksasa.",
          title: "Globalisasi dan Masyarakat Digital",
        },
      },
      sections: [
        {
          slug: "globalization",
          translations: {
            en: {
              title: "Understanding Globalization",
            },
            id: {
              title: "Memahami Globalisasi",
            },
          },
        },
        {
          slug: "digital-development",
          translations: {
            en: {
              title: "Digital Society Development",
            },
            id: {
              title: "Perkembangan Masyarakat Digital",
            },
          },
        },
        {
          slug: "society-response",
          translations: {
            en: {
              title: "Society's Response to Globalization and Digital Era",
            },
            id: {
              title: "Respons Masyarakat terhadap Globalisasi dan Era Digital",
            },
          },
        },
      ],
    },
    {
      slug: "global-digital-problems",
      translations: {
        en: {
          description:
            "New challenges emerging from technological advancement and global connectivity.",
          title: "Social Problems Due to Globalization and Digital Era",
        },
        id: {
          description:
            "Tantangan baru yang muncul dari kemajuan teknologi dan keterhubungan global.",
          title: "Masalah Sosial Akibat Globalisasi dan Era Digital",
        },
      },
      sections: [
        {
          slug: "causes",
          translations: {
            en: {
              title:
                "Causes of Social Problems Due to Globalization and Digital Era",
            },
            id: {
              title:
                "Penyebab Masalah Sosial Akibat Globalisasi dan Era Digital",
            },
          },
        },
        {
          slug: "variety",
          translations: {
            en: {
              title:
                "Variety of Social Problems Due to Globalization and Digital Era",
            },
            id: {
              title: "Ragam Masalah Sosial Akibat Globalisasi dan Era Digital",
            },
          },
        },
        {
          slug: "solutions",
          translations: {
            en: {
              title:
                "Efforts to Overcome Problems Due to Globalization and Digital Era",
            },
            id: {
              title:
                "Upaya Mengatasi Masalah Akibat Globalisasi dan Era Digital",
            },
          },
        },
      ],
    },
    {
      slug: "local-empowerment",
      translations: {
        en: {
          description: "How local wisdom can guide community empowerment.",
          title: "Community Empowerment Based on Local Wisdom",
        },
        id: {
          description:
            "Menggali kekuatan tradisi untuk membangun masa depan yang berkelanjutan.",
          title: "Pemberdayaan Komunitas Berbasis Kearifan Lokal",
        },
      },
      sections: [
        {
          slug: "potential",
          translations: {
            en: {
              title: "Empowerment and Local Wisdom Potential",
            },
            id: {
              title: "Pemberdayaan dan Potensi Kearifan Lokal",
            },
          },
        },
        {
          slug: "actions",
          translations: {
            en: {
              title: "Various Community Empowerment Actions",
            },
            id: {
              title: "Berbagai Aksi Pemberdayaan Komunitas",
            },
          },
        },
        {
          slug: "steps",
          translations: {
            en: {
              title: "Stages of Local Community Empowerment",
            },
            id: {
              title: "Tahapan Pemberdayaan Komunitas Lokal",
            },
          },
        },
      ],
    },
  ],
});
