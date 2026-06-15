import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11PhysicsFluidTopic = defineSubjectMaterialTopic({
  slug: "fluid",
  translations: {
    en: {
      description:
        "Science that reveals the mystery of flowing liquids and moving gases in daily life.",
      title: "Fluids",
    },
    id: {
      description:
        "Ilmu yang mengungkap misteri cairan mengalir dan gas bergerak dalam kehidupan sehari-hari.",
      title: "Fluida",
    },
  },
  sections: [
    {
      slug: "static-fluid",
      translations: {
        en: {
          title: "Static Fluids",
        },
        id: {
          title: "Fluida Statis",
        },
      },
    },
    {
      slug: "hydrostatic-pressure",
      translations: {
        en: {
          title: "Hydrostatic Pressure",
        },
        id: {
          title: "Tekanan Hidrostatis",
        },
      },
    },
    {
      slug: "archimedes-principle",
      translations: {
        en: {
          title: "Archimedes' Principle",
        },
        id: {
          title: "Prinsip Archimedes",
        },
      },
    },
    {
      slug: "surface-tension",
      translations: {
        en: {
          title: "Surface Tension",
        },
        id: {
          title: "Tegangan Permukaan",
        },
      },
    },
    {
      slug: "viscosity",
      translations: {
        en: {
          title: "Viscosity",
        },
        id: {
          title: "Viskositas",
        },
      },
    },
    {
      slug: "dynamic-fluid",
      translations: {
        en: {
          title: "Dynamic Fluids",
        },
        id: {
          title: "Fluida Dinamis",
        },
      },
    },
    {
      slug: "ideal-fluid",
      translations: {
        en: {
          title: "Ideal Fluid",
        },
        id: {
          title: "Fluida Ideal",
        },
      },
    },
    {
      slug: "continuity-principle",
      translations: {
        en: {
          title: "Continuity Principle",
        },
        id: {
          title: "Asas Kontinuitas",
        },
      },
    },
    {
      slug: "bernoulli-equation",
      translations: {
        en: {
          title: "Bernoulli's Equation",
        },
        id: {
          title: "Persamaan Bernoulli",
        },
      },
    },
    {
      slug: "bernoulli-principle-application",
      translations: {
        en: {
          title: "Bernoulli's Principle Application",
        },
        id: {
          title: "Penerapan Prinsip Bernoulli",
        },
      },
    },
  ],
});
