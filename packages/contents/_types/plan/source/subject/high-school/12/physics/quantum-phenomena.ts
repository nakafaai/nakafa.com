import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool12PhysicsQuantumPhenomenaTopic =
  defineSubjectPlanTopic({
    slug: "quantum-phenomena",
    translations: {
      en: {
        description:
          "Strange world of particles enabling lasers, LEDs, and future quantum computers.",
        title: "Quantum Phenomena",
      },
      id: {
        description:
          "Dunia aneh partikel yang memungkinkan laser, LED, dan komputer kuantum masa depan.",
        title: "Gejala Kuantum",
      },
    },
    sections: [
      {
        slug: "photon-concept",
        translations: {
          en: {
            title: "Photon Concept",
          },
          id: {
            title: "Konsep Foton",
          },
        },
      },
      {
        slug: "black-body-radiation",
        translations: {
          en: {
            title: "Black Body Radiation",
          },
          id: {
            title: "Radiasi Benda Hitam",
          },
        },
      },
      {
        slug: "wien-shift",
        translations: {
          en: {
            title: "Wien's Displacement",
          },
          id: {
            title: "Pergeseran Wien",
          },
        },
      },
      {
        slug: "planck-quantum-theory",
        translations: {
          en: {
            title: "Planck's Quantum Theory",
          },
          id: {
            title: "Teori Kuantum Planck",
          },
        },
      },
      {
        slug: "photoelectric-effect",
        translations: {
          en: {
            title: "Photoelectric Effect",
          },
          id: {
            title: "Efek Fotolistrik",
          },
        },
      },
      {
        slug: "compton-effect",
        translations: {
          en: {
            title: "Compton Effect",
          },
          id: {
            title: "Efek Compton",
          },
        },
      },
      {
        slug: "x-ray",
        translations: {
          en: {
            title: "X-Rays",
          },
          id: {
            title: "Sinar X",
          },
        },
      },
    ],
  });
