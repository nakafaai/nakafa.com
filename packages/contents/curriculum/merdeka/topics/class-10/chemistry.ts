import {
  materialNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";

export const merdekaClass10ChemistryTopicNodes = [
  unitNode({
    key: "class-10-chemistry-basic-chemistry-laws",
    materialCard: {
      en: {
        description: "Spot chemical changes from evidence.",
        title: "Basic Laws of Chemistry",
      },
      id: {
        description: "Kenali perubahan kimia dari bukti.",
        title: "Hukum Dasar Kimia",
      },
    },
    children: [
      materialNode({
        key: "class-10-chemistry-basic-chemistry-laws-material",
        level: "lesson",
        materialKeys: ["lesson.chemistry.basic-chemistry-laws"],
        order: 10,
      }),
    ],
    order: 10,
    translations: {
      en: {
        routeSlug: "basic-chemistry-laws",
        title: "Basic Laws of Chemistry",
      },
      id: { routeSlug: "hukum-dasar-kimia", title: "Hukum Dasar Kimia" },
    },
  }),
  unitNode({
    key: "class-10-chemistry-green-chemistry",
    materialCard: {
      en: {
        description: "Judge reactions with green chemistry ideas.",
        title: "Green Chemistry",
      },
      id: {
        description: "Nilai reaksi lewat prinsip kimia hijau.",
        title: "Kimia Hijau",
      },
    },
    children: [
      materialNode({
        key: "class-10-chemistry-green-chemistry-material",
        level: "lesson",
        materialKeys: ["lesson.chemistry.green-chemistry"],
        order: 10,
      }),
    ],
    order: 20,
    translations: {
      en: { routeSlug: "green-chemistry", title: "Green Chemistry" },
      id: { routeSlug: "kimia-hijau", title: "Kimia Hijau" },
    },
  }),
  unitNode({
    key: "class-10-chemistry-structure-matter",
    materialCard: {
      en: {
        description: "Use atomic ideas to explain matter.",
        title: "Atomic Structure",
      },
      id: {
        description: "Gunakan konsep atom untuk memahami materi.",
        title: "Struktur Atom",
      },
    },
    children: [
      materialNode({
        key: "class-10-chemistry-structure-matter-material",
        level: "lesson",
        materialKeys: ["lesson.chemistry.structure-matter"],
        order: 10,
      }),
    ],
    order: 30,
    translations: {
      en: { routeSlug: "structure-matter", title: "Atomic Structure" },
      id: { routeSlug: "struktur-atom", title: "Struktur Atom" },
    },
  }),
];
