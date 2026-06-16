import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonChemistryStructureMatterMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/chemistry/structure-matter",
  domain: "chemistry",
  key: "lesson.chemistry.structure-matter",
  kind: "lesson",
  slug: "structure-matter",
  translations: {
    en: {
      description:
        "Start from a simple question about cutting matter again and again, then see why the atomic idea appeared before modern laboratory tools existed.",
      title: "Atomic Structure",
    },
    id: {
      description:
        "Mulai dari pertanyaan sederhana tentang benda yang dipotong terus-menerus, lalu lihat mengapa gagasan atom lahir sebelum alat laboratorium modern ada.",
      title: "Struktur Atom",
    },
  },
  sections: [
    {
      slug: "ancient-atom-concept",
      translations: {
        en: {
          title: "Ancient Greek Atomic Concept",
        },
        id: {
          title: "Konsep Atom Zaman Yunani",
        },
      },
    },
    {
      slug: "atom-shell",
      translations: {
        en: {
          title: "Atomic Shells",
        },
        id: {
          title: "Kulit Atom",
        },
      },
    },
    {
      slug: "atom-symbol",
      translations: {
        en: {
          title: "Atomic Symbol",
        },
        id: {
          title: "Lambang Atom",
        },
      },
    },
    {
      slug: "electron-configuration",
      translations: {
        en: {
          title: "Electron Configuration",
        },
        id: {
          title: "Konfigurasi Elektron",
        },
      },
    },
    {
      slug: "ion",
      translations: {
        en: {
          title: "Ions",
        },
        id: {
          title: "Ion",
        },
      },
    },
    {
      slug: "isotope",
      translations: {
        en: {
          title: "Isotopes",
        },
        id: {
          title: "Isotop",
        },
      },
    },
    {
      slug: "modern-periodic-table",
      translations: {
        en: {
          title: "Modern Periodic Table",
        },
        id: {
          title: "Sistem Periodik Unsur Modern",
        },
      },
    },
    {
      slug: "periodic-properties",
      translations: {
        en: {
          title: "Periodic Properties of Elements",
        },
        id: {
          title: "Sifat Keperiodikan Unsur",
        },
      },
    },
    {
      slug: "reconceptualization-atom",
      translations: {
        en: {
          title: "Atomic Reconceptualization",
        },
        id: {
          title: "Rekonseptualisasi Atom",
        },
      },
    },
    {
      slug: "subatomic-particles",
      translations: {
        en: {
          title: "Subatomic Particles",
        },
        id: {
          title: "Partikel Subatom",
        },
      },
    },
    {
      slug: "subatomic-particles-properties",
      translations: {
        en: {
          title: "Subatomic Particle Properties",
        },
        id: {
          title: "Sifat Partikel Subatom",
        },
      },
    },
    {
      slug: "valence-electron",
      translations: {
        en: {
          title: "Valence Electrons",
        },
        id: {
          title: "Elektron Valensi",
        },
      },
    },
  ],
});
