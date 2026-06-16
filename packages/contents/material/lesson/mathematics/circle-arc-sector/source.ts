import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsCircleArcSectorMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/circle-arc-sector",
  domain: "mathematics",
  key: "lesson.mathematics.circle-arc-sector",
  kind: "lesson",
  slug: "circle-arc-sector",
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
