import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11ChemistryAtomicStructurePeriodicTableTopic =
  defineSubjectPlanTopic({
    slug: "atomic-structure-periodic-table",
    translations: {
      en: {
        description:
          "Secret map of the universe revealing how elements compose our world.",
        title: "Atomic Structure and Periodic Table",
      },
      id: {
        description:
          "Peta rahasia alam semesta yang mengungkap bagaimana unsur-unsur menyusun dunia kita.",
        title: "Struktur Atom dan Sistem Periodik Unsur",
      },
    },
    sections: [
      {
        slug: "structure-atom",
        translations: {
          en: {
            title: "Atomic Structure",
          },
          id: {
            title: "Struktur Atom",
          },
        },
      },
      {
        slug: "quantum-mechanics-theory",
        translations: {
          en: {
            title: "Quantum Mechanics Atomic Theory",
          },
          id: {
            title: "Teori Atom Mekanika Kuantum",
          },
        },
      },
      {
        slug: "periodic-table",
        translations: {
          en: {
            title: "Periodic Table System",
          },
          id: {
            title: "Sistem Periodik Unsur",
          },
        },
      },
      {
        slug: "periodic-properties",
        translations: {
          en: {
            title: "Periodic Properties of Elements",
          },
          id: {
            title: "Sifat Periodik Unsur",
          },
        },
      },
    ],
  });
