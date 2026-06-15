import { defineSubjectMaterialTopic } from "@repo/contents/_types/material/schema";

export const subjectHighSchool11BiologyCellMembraneTopic =
  defineSubjectMaterialTopic({
    slug: "cell-membrane",
    translations: {
      en: {
        description:
          "Vital mechanism regulating molecular entry and exit for cell survival.",
        title: "Movement of Substances through Cell Membrane",
      },
      id: {
        description:
          "Mekanisme vital yang mengatur keluar masuk molekul untuk kelangsungan hidup sel.",
        title: "Pergerakan Zat melalui Membran Sel",
      },
    },
    sections: [
      {
        slug: "passive-transport",
        translations: {
          en: {
            title: "Passive Transport",
          },
          id: {
            title: "Transpor Pasif",
          },
        },
      },
      {
        slug: "active-transport",
        translations: {
          en: {
            title: "Active Transport",
          },
          id: {
            title: "Transpor Aktif",
          },
        },
      },
    ],
  });
