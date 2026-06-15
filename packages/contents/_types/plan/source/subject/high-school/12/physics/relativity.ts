import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12PhysicsRelativityTopic = defineSubjectPlanTopic(
  {
    slug: "relativity",
    translations: {
      en: {
        description:
          "Einstein's revolutionary theory revealing secrets of space, time, and speed of light.",
        title: "Relativity",
      },
      id: {
        description:
          "Teori revolusioner Einstein yang mengungkap rahasia ruang, waktu, dan kecepatan cahaya.",
        title: "Relativitas",
      },
    },
    sections: [
      {
        slug: "newtonian-relative-motion",
        translations: {
          en: {
            title: "Newtonian Relative Motion",
          },
          id: {
            title: "Gerak Relatif Newton",
          },
        },
      },
      {
        slug: "einstein-relativity",
        translations: {
          en: {
            title: "Einstein's Relativity",
          },
          id: {
            title: "Relativitas Einstein",
          },
        },
      },
      {
        slug: "time-dilation",
        translations: {
          en: {
            title: "Time Dilation",
          },
          id: {
            title: "Dilatasi Waktu",
          },
        },
      },
      {
        slug: "velocity-addition",
        translations: {
          en: {
            title: "Velocity Addition",
          },
          id: {
            title: "Penambahan Kecepatan",
          },
        },
      },
    ],
  }
);
