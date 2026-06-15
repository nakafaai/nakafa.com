import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool12PhysicsAlternatingCurrentTopic =
  defineSubjectMaterialTopic({
    slug: "alternating-current",
    translations: {
      en: {
        description:
          "Revolutionary technology that brings electricity to homes around the world.",
        title: "Alternating Current",
      },
      id: {
        description:
          "Teknologi revolusioner yang membawa listrik ke rumah-rumah di seluruh dunia.",
        title: "Arus Bolak-balik",
      },
    },
    sections: [
      {
        slug: "alternating-current-equation",
        translations: {
          en: {
            title: "Alternating Current Equation",
          },
          id: {
            title: "Persamaan Arus Bolak Balik",
          },
        },
      },
      {
        slug: "resistor",
        translations: {
          en: {
            title: "Resistor",
          },
          id: {
            title: "Resistor",
          },
        },
      },
      {
        slug: "inductor",
        translations: {
          en: {
            title: "Inductor",
          },
          id: {
            title: "Induktor",
          },
        },
      },
      {
        slug: "capacitor",
        translations: {
          en: {
            title: "Capacitor",
          },
          id: {
            title: "Kapasitor",
          },
        },
      },
      {
        slug: "rlc-circuit",
        translations: {
          en: {
            title: "RLC Circuit",
          },
          id: {
            title: "Rangkaian R-L-C",
          },
        },
      },
      {
        slug: "resonance-circuit",
        translations: {
          en: {
            title: "Circuit Resonance",
          },
          id: {
            title: "Resonansi Rangkaian",
          },
        },
      },
    ],
  });
