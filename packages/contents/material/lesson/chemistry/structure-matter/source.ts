import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonChemistryStructureMatterMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/chemistry/structure-matter",
  domain: "chemistry",
  key: "lesson.chemistry.structure-matter",
  kind: "lesson",
  slug: "structure-matter",
  routeSlugs: { en: "structure-matter", id: "struktur-atom" },
  translations: {
    en: {
      description: "See why atomic ideas explain matter beyond sight.",
      title: "Atomic Structure",
    },
    id: {
      description: "Lihat cara atom menjelaskan materi tak kasatmata.",
      title: "Struktur Atom",
    },
  },
  sections: [
    {
      slug: "ancient-atom-concept",
      routeSlugs: {
        en: "ancient-atom-concept",
        id: "konsep-atom-zaman-yunani",
      },
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
      routeSlugs: { en: "atom-shell", id: "kulit-atom" },
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
      routeSlugs: { en: "atom-symbol", id: "lambang-atom" },
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
      routeSlugs: { en: "electron-configuration", id: "konfigurasi-elektron" },
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
      routeSlugs: { en: "ion", id: "ion" },
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
      routeSlugs: { en: "isotope", id: "isotop" },
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
      routeSlugs: {
        en: "modern-periodic-table",
        id: "sistem-periodik-unsur-modern",
      },
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
      routeSlugs: { en: "periodic-properties", id: "sifat-keperiodikan-unsur" },
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
      routeSlugs: {
        en: "reconceptualization-atom",
        id: "rekonseptualisasi-atom",
      },
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
      routeSlugs: { en: "subatomic-particles", id: "partikel-subatom" },
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
      routeSlugs: {
        en: "subatomic-particles-properties",
        id: "sifat-partikel-subatom",
      },
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
      routeSlugs: { en: "valence-electron", id: "elektron-valensi" },
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
