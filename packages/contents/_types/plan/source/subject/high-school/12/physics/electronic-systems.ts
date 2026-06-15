import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12PhysicsElectronicSystemsTopic =
  defineSubjectPlanTopic({
    slug: "electronic-systems",
    translations: {
      en: {
        description:
          "How electronic components support systems from simple circuits to computers.",
        title: "Introduction to Electronic Systems",
      },
      id: {
        description:
          "Gerbang menuju teknologi digital yang mengubah dunia dari LED hingga komputer modern.",
        title: "Pengantar Sistem Elektronika",
      },
    },
    sections: [
      {
        slug: "electronic-system",
        translations: {
          en: {
            title: "Electronic Systems",
          },
          id: {
            title: "Sistem Elektronika",
          },
        },
      },
      {
        slug: "semiconductor",
        translations: {
          en: {
            title: "Semiconductors",
          },
          id: {
            title: "Semikonduktor",
          },
        },
      },
      {
        slug: "led",
        translations: {
          en: {
            title: "Light-Emitting Diode (LED)",
          },
          id: {
            title: "Light-Emitting Diode (LED)",
          },
        },
      },
      {
        slug: "transistor",
        translations: {
          en: {
            title: "Transistor",
          },
          id: {
            title: "Transistor",
          },
        },
      },
      {
        slug: "integrated-circuit",
        translations: {
          en: {
            title: "Integrated Circuit (IC)",
          },
          id: {
            title: "Sirkuit Terpadu (Integrated Circuit / IC)",
          },
        },
      },
      {
        slug: "logic-gate",
        translations: {
          en: {
            title: "Logic Gate Principles",
          },
          id: {
            title: "Prinsip Gerbang Logika",
          },
        },
      },
    ],
  });
