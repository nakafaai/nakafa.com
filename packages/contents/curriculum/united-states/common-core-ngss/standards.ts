import type { CurriculumNodeInput } from "@repo/contents/_types/curriculum/schema";

export const commonCoreNgssStandardNodes = [
  {
    key: "high-school-mathematics",
    level: "course",
    materialKeys: [],
    order: 10,
    translations: {
      en: {
        title: "High School Mathematics",
        description:
          "Common Core high school mathematics categories awaiting verified Nakafa material mappings.",
      },
      id: {
        title: "High School Mathematics",
        description:
          "Kategori matematika SMA Common Core menunggu pemetaan materi Nakafa yang terverifikasi.",
      },
    },
  },
  {
    key: "high-school-mathematics-number-quantity",
    level: "unit",
    materialKeys: [],
    order: 10,
    parentKey: "high-school-mathematics",
    translations: {
      en: { title: "Number and Quantity" },
      id: { title: "Bilangan dan Kuantitas" },
    },
  },
  {
    key: "high-school-mathematics-algebra",
    level: "unit",
    materialKeys: [],
    order: 20,
    parentKey: "high-school-mathematics",
    translations: {
      en: { title: "Algebra" },
      id: { title: "Aljabar" },
    },
  },
  {
    key: "high-school-mathematics-functions",
    level: "unit",
    materialKeys: [],
    order: 30,
    parentKey: "high-school-mathematics",
    translations: {
      en: { title: "Functions" },
      id: { title: "Fungsi" },
    },
  },
  {
    key: "high-school-mathematics-modeling",
    level: "unit",
    materialKeys: [],
    order: 40,
    parentKey: "high-school-mathematics",
    translations: {
      en: { title: "Modeling" },
      id: { title: "Pemodelan" },
    },
  },
  {
    key: "high-school-mathematics-geometry",
    level: "unit",
    materialKeys: [],
    order: 50,
    parentKey: "high-school-mathematics",
    translations: {
      en: { title: "Geometry" },
      id: { title: "Geometri" },
    },
  },
  {
    key: "high-school-mathematics-statistics-probability",
    level: "unit",
    materialKeys: [],
    order: 60,
    parentKey: "high-school-mathematics",
    translations: {
      en: { title: "Statistics and Probability" },
      id: { title: "Statistika dan Peluang" },
    },
  },
  {
    key: "high-school-science",
    level: "course",
    materialKeys: [],
    order: 20,
    translations: {
      en: {
        title: "High School Science",
        description:
          "NGSS high school science domains awaiting verified Nakafa material mappings.",
      },
      id: {
        title: "High School Science",
        description:
          "Domain sains SMA NGSS menunggu pemetaan materi Nakafa yang terverifikasi.",
      },
    },
  },
  {
    key: "high-school-science-physical-sciences",
    level: "unit",
    materialKeys: [],
    order: 10,
    parentKey: "high-school-science",
    translations: {
      en: { title: "Physical Sciences" },
      id: { title: "Ilmu Fisika" },
    },
  },
  {
    key: "high-school-science-life-sciences",
    level: "unit",
    materialKeys: [],
    order: 20,
    parentKey: "high-school-science",
    translations: {
      en: { title: "Life Sciences" },
      id: { title: "Ilmu Hayati" },
    },
  },
  {
    key: "high-school-science-earth-space-sciences",
    level: "unit",
    materialKeys: [],
    order: 30,
    parentKey: "high-school-science",
    translations: {
      en: { title: "Earth and Space Sciences" },
      id: { title: "Ilmu Bumi dan Antariksa" },
    },
  },
  {
    key: "high-school-science-engineering",
    level: "unit",
    materialKeys: [],
    order: 40,
    parentKey: "high-school-science",
    translations: {
      en: { title: "Engineering, Technology, and Applications" },
      id: { title: "Rekayasa, Teknologi, dan Aplikasi" },
    },
  },
] satisfies readonly CurriculumNodeInput[];
