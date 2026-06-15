import { defineSubjectPlanTopic } from "@repo/contents/_types/plan/schema";

export const subjectHighSchool11BiologyHumanDefenseTopic =
  defineSubjectPlanTopic({
    slug: "human-defense",
    translations: {
      en: {
        description:
          "Elite body forces fighting bacteria, viruses, and other health threats.",
        title: "Body Defense System against Disease",
      },
      id: {
        description:
          "Pasukan elit tubuh yang melawan bakteri, virus, dan ancaman kesehatan lainnya.",
        title: "Sistem Pertahanan Tubuh terhadap Penyakit",
      },
    },
    sections: [
      {
        slug: "external-internal-defense",
        translations: {
          en: {
            title: "External and Internal Defense Systems",
          },
          id: {
            title: "Sistem Pertahanan Eksternal dan Internal",
          },
        },
      },
      {
        slug: "components",
        translations: {
          en: {
            title: "Components of Body Defense System",
          },
          id: {
            title: "Komponen Sistem Pertahanan Tubuh",
          },
        },
      },
      {
        slug: "immunity",
        translations: {
          en: {
            title: "Body Immunity and Its Disorders",
          },
          id: {
            title: "Imunitas Tubuh dan Kelainannya",
          },
        },
      },
    ],
  });
