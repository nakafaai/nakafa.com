import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsCircleArcSectorMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/circle-arc-sector",
  domain: "mathematics",
  key: "lesson.mathematics.circle-arc-sector",
  kind: "lesson",
  slug: "circle-arc-sector",
  routeSlugs: { en: "circle-arc-sector", id: "busur-dan-juring-lingkaran" },
  translations: {
    en: {
      description:
        "Learn circle arcs, arc length formulas, and central angle relationships. Learn minor, major, and semicircular arcs with worked examples.",
      title: "Circle Arcs and Sectors",
    },
    id: {
      description:
        "Pelajari busur lingkaran, rumus panjang busur, dan hubungan dengan sudut pusat. Pahami busur kecil, besar, dan setengah lingkaran lewat contoh soal.",
      title: "Busur dan Juring Lingkaran",
    },
  },
  sections: [
    {
      slug: "arc",
      routeSlugs: { en: "arc", id: "busur" },
      translations: {
        en: {
          title: "Arc",
        },
        id: {
          title: "Busur",
        },
      },
    },
    {
      slug: "central-angle-on-arc",
      routeSlugs: { en: "central-angle-on-arc", id: "sudut-pusat-pada-busur" },
      translations: {
        en: {
          title: "Central Angle on Arc",
        },
        id: {
          title: "Sudut Pusat pada Busur",
        },
      },
    },
    {
      slug: "central-angle-on-sector",
      routeSlugs: {
        en: "central-angle-on-sector",
        id: "sudut-pusat-pada-juring",
      },
      translations: {
        en: {
          title: "Central Angle on Sector",
        },
        id: {
          title: "Sudut Pusat pada Juring",
        },
      },
    },
    {
      slug: "chord",
      routeSlugs: { en: "chord", id: "tali-busur" },
      translations: {
        en: {
          title: "Chord",
        },
        id: {
          title: "Tali Busur",
        },
      },
    },
    {
      slug: "circle-arc",
      routeSlugs: { en: "circle-arc", id: "busur-lingkaran" },
      translations: {
        en: {
          title: "Circle Arc",
        },
        id: {
          title: "Busur Lingkaran",
        },
      },
    },
    {
      slug: "circle-sector",
      routeSlugs: { en: "circle-sector", id: "juring-lingkaran" },
      translations: {
        en: {
          title: "Circle Sector",
        },
        id: {
          title: "Juring Lingkaran",
        },
      },
    },
    {
      slug: "pi-history",
      routeSlugs: { en: "pi-history", id: "sejarah-nilai-pi" },
      translations: {
        en: {
          title: "History of Pi",
        },
        id: {
          title: "Sejarah Nilai Pi",
        },
      },
    },
    {
      slug: "relationship-between-arc-length-and-sector-area",
      routeSlugs: {
        en: "relationship-between-arc-length-and-sector-area",
        id: "hubungan-panjang-busur-dan-luas-juring",
      },
      translations: {
        en: {
          title: "Relationship Between Arc Length and Sector Area",
        },
        id: {
          title: "Hubungan Panjang Busur dan Luas Juring",
        },
      },
    },
    {
      slug: "sector",
      routeSlugs: { en: "sector", id: "juring" },
      translations: {
        en: {
          title: "Sector",
        },
        id: {
          title: "Juring",
        },
      },
    },
    {
      slug: "segment",
      routeSlugs: { en: "segment", id: "tembereng" },
      translations: {
        en: {
          title: "Segment",
        },
        id: {
          title: "Tembereng",
        },
      },
    },
  ],
});
