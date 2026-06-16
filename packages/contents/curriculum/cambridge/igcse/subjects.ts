import type { CurriculumNodeInput } from "@repo/contents/_types/curriculum/schema";

export const igcseSubjectNodes = [
  {
    key: "mathematics-0580",
    level: "course",
    materialKeys: [],
    order: 10,
    translations: {
      en: {
        title: "Mathematics 0580",
        description:
          "Cambridge IGCSE Mathematics 0580 mapped only where Nakafa material is verified.",
      },
      id: {
        title: "Mathematics 0580",
        description:
          "Cambridge IGCSE Mathematics 0580 dipetakan hanya pada materi Nakafa yang sudah terverifikasi.",
      },
    },
  },
] satisfies readonly CurriculumNodeInput[];
