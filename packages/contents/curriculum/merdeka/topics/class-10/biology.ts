import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const merdekaClass10BiologyTopicNodes = [
  unitNode({
    key: "class-10-biology-biodiversity",
    materialCard: {
      en: {
        description: "Connect bacterial shapes and life roles.",
        title: "Biodiversity of Living Organisms",
      },
      id: {
        description: "Kenali bentuk bakteri dan perannya.",
        title: "Keanekaragaman Makhluk Hidup",
      },
    },
    children: [
      materialNode({
        key: "class-10-biology-biodiversity-material",
        level: "lesson",
        materialKeys: ["lesson.biology.biodiversity"],
        order: 10,
      }),
    ],
    order: 10,
    translations: {
      en: {
        routeSlug: "biodiversity",
        title: "Biodiversity of Living Organisms",
      },
      id: {
        routeSlug: "keanekaragaman-makhluk-hidup",
        title: "Keanekaragaman Makhluk Hidup",
      },
    },
  }),
  unitNode({
    key: "class-10-biology-climate-change",
    materialCard: {
      en: {
        description: "Trace how human activity traps heat.",
        title: "Climate Change",
      },
      id: {
        description: "Telusuri aktivitas yang memerangkap panas.",
        title: "Perubahan Iklim",
      },
    },
    children: [
      materialNode({
        key: "class-10-biology-climate-change-material",
        level: "lesson",
        materialKeys: ["lesson.biology.climate-change"],
        order: 10,
      }),
    ],
    order: 20,
    translations: {
      en: { routeSlug: "climate-change", title: "Climate Change" },
      id: { routeSlug: "perubahan-iklim", title: "Perubahan Iklim" },
    },
  }),
  unitNode({
    key: "class-10-biology-virus-role",
    materialCard: {
      en: {
        description: "Follow how viruses copy inside host cells.",
        title: "Viruses and Their Role",
      },
      id: {
        description: "Ikuti cara virus menggandakan diri.",
        title: "Virus dan Peranannya",
      },
    },
    children: [
      materialNode({
        key: "class-10-biology-virus-role-material",
        level: "lesson",
        materialKeys: ["lesson.biology.virus-role"],
        order: 10,
      }),
    ],
    order: 30,
    translations: {
      en: { routeSlug: "virus-role", title: "Viruses and Their Role" },
      id: { routeSlug: "virus-dan-peranannya", title: "Virus dan Peranannya" },
    },
  }),
];
