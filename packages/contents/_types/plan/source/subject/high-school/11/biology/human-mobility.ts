import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11BiologyHumanMobilityTopic =
  defineSubjectPlanTopic({
    slug: "human-mobility",
    translations: {
      en: {
        description:
          "Perfect coordination between brain, nerves, and muscles for every body movement.",
        title: "Human Mobility",
      },
      id: {
        description:
          "Koordinasi sempurna antara otak, saraf, dan otot untuk setiap gerakan tubuh.",
        title: "Mobilitas pada Manusia",
      },
    },
    sections: [
      {
        slug: "nervous-system",
        translations: {
          en: {
            title: "Nervous System Structure",
          },
          id: {
            title: "Struktur Sistem Saraf",
          },
        },
      },
      {
        slug: "nervous-system-function",
        translations: {
          en: {
            title: "Nervous System Function",
          },
          id: {
            title: "Fungsi Sistem Saraf",
          },
        },
      },
      {
        slug: "muscular-system",
        translations: {
          en: {
            title: "Muscular System Structure",
          },
          id: {
            title: "Struktur Sistem Gerak",
          },
        },
      },
      {
        slug: "muscular-system-function",
        translations: {
          en: {
            title: "Muscular System Function",
          },
          id: {
            title: "Fungsi Sistem Gerak",
          },
        },
      },
      {
        slug: "muscular-system-abnormalities",
        translations: {
          en: {
            title: "Muscular System Abnormalities",
          },
          id: {
            title: "Kelainan pada Sistem Gerak",
          },
        },
      },
      {
        slug: "nervous-muscular-relationship",
        translations: {
          en: {
            title: "Relationship between Nervous and Muscular Systems",
          },
          id: {
            title: "Keterkaitan antara Sistem Saraf dan Sistem Gerak",
          },
        },
      },
    ],
  });
