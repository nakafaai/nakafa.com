import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11MathematicsCircleTopic = defineSubjectPlanTopic(
  {
    slug: "circle",
    translations: {
      en: {
        description:
          "Perfect shape that forms the basis of wheel mechanics and architectural design.",
        title: "Circle",
      },
      id: {
        description:
          "Bentuk sempurna yang membentuk dasar mekanika roda dan desain arsitektur.",
        title: "Lingkaran",
      },
    },
    sections: [
      {
        slug: "circle-and-arc-circle",
        translations: {
          en: {
            title: "Circle and Arc Circle",
          },
          id: {
            title: "Lingkaran dan Busur Lingkaran",
          },
        },
      },
      {
        slug: "central-angle-and-inscribed-angle",
        translations: {
          en: {
            title: "Central Angle and Inscribed Angle",
          },
          id: {
            title: "Sudut Pusat dan Sudut Keliling",
          },
        },
      },
      {
        slug: "properties-of-angle-in-circle",
        translations: {
          en: {
            title: "Properties of Angle in Circle",
          },
          id: {
            title: "Sifat Sudut dalam Lingkaran",
          },
        },
      },
      {
        slug: "circle-and-tangent-line",
        translations: {
          en: {
            title: "Circle and Tangent Line",
          },
          id: {
            title: "Lingkaran dan Garis Singgung",
          },
        },
      },
      {
        slug: "external-tangent-line-and-internal-tangent-line",
        translations: {
          en: {
            title: "External Tangent Line and Internal Tangent Line",
          },
          id: {
            title: "Garis Singgung Persekutuan Luar dan Dalam",
          },
        },
      },
      {
        slug: "circle-and-chord",
        translations: {
          en: {
            title: "Circle and Chord",
          },
          id: {
            title: "Lingkaran dan Tali Busur",
          },
        },
      },
    ],
  }
);
