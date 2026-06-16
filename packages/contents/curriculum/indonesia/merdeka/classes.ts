import type { CurriculumNodeInput } from "@repo/contents/_types/curriculum/schema";

export const merdekaClassNodes = [
  {
    key: "class-10",
    level: "class",
    materialKeys: [],
    order: 100,
    translations: {
      en: {
        title: "Class 10",
      },
      id: {
        title: "Kelas 10",
      },
    },
  },
  {
    key: "class-11",
    level: "class",
    materialKeys: [],
    order: 110,
    translations: {
      en: {
        title: "Class 11",
      },
      id: {
        title: "Kelas 11",
      },
    },
  },
  {
    key: "class-12",
    level: "class",
    materialKeys: [],
    order: 120,
    translations: {
      en: {
        title: "Class 12",
      },
      id: {
        title: "Kelas 12",
      },
    },
  },
] satisfies readonly CurriculumNodeInput[];
