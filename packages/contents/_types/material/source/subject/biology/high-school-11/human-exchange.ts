import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11BiologyHumanExchangeTopic =
  defineSubjectMaterialTopic({
    slug: "human-exchange",
    translations: {
      en: {
        description:
          "Advanced transport network delivering oxygen and nutrients throughout the body.",
        title: "Transport and Exchange of Substances in Humans",
      },
      id: {
        description:
          "Jaringan transportasi canggih yang mengirimkan oksigen dan nutrisi ke seluruh tubuh.",
        title: "Transpor dan Pertukaran Zat pada Manusia",
      },
    },
    sections: [
      {
        slug: "body-structure",
        translations: {
          en: {
            title: "Body Structure for Substance Exchange and Transport",
          },
          id: {
            title: "Struktur Tubuh untuk Pertukaran dan Transpor Zat",
          },
        },
      },
      {
        slug: "exchange-transport",
        translations: {
          en: {
            title: "Substance Exchange and Transport Processes",
          },
          id: {
            title: "Proses Pertukaran dan Transpor Zat",
          },
        },
      },
      {
        slug: "abnormalities",
        translations: {
          en: {
            title: "Abnormalities in Substance Exchange and Transport",
          },
          id: {
            title: "Kelainan pada Pertukaran dan Transpor Zat",
          },
        },
      },
    ],
  });
