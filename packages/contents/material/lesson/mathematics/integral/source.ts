import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsIntegralMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/integral",
  domain: "mathematics",
  key: "lesson.mathematics.integral",
  kind: "lesson",
  slug: "integral",
  translations: {
    en: {
      description:
        "Calculate flat surface areas using definite integrals with worked solutions. Learn quadratic and irrational functions through practical examples.",
      title: "Integrals",
    },
    id: {
      description:
        "Hitung luas bidang datar menggunakan integral tentu dengan solusi bertahap. Pelajari fungsi kuadrat dan irasional melalui contoh praktis.",
      title: "Integral",
    },
  },
  sections: [
    {
      slug: "area-of-a-flat-surface",
      translations: {
        en: {
          title: "Area of a Flat Surface",
        },
        id: {
          title: "Luas Bidang Datar",
        },
      },
    },
    {
      slug: "definite-integral",
      translations: {
        en: {
          title: "Definite Integral",
        },
        id: {
          title: "Integral Tentu",
        },
      },
    },
    {
      slug: "definition-of-indefinite-integral",
      translations: {
        en: {
          title: "Definition of Indefinite Integral",
        },
        id: {
          title: "Definisi Integral Tak Tentu",
        },
      },
    },
    {
      slug: "fundamental-theorem-of-calculus",
      translations: {
        en: {
          title: "Fundamental Theorem of Calculus",
        },
        id: {
          title: "Teorema Dasar Kalkulus",
        },
      },
    },
    {
      slug: "integral-in-economics-and-business",
      translations: {
        en: {
          title: "Integral in Economics and Business",
        },
        id: {
          title: "Integral dalam Bidang Ekonomi dan Bisnis",
        },
      },
    },
    {
      slug: "integral-in-physics",
      translations: {
        en: {
          title: "Integral in Physics",
        },
        id: {
          title: "Integral dalam Bidang Fisika",
        },
      },
    },
    {
      slug: "properties-of-definite-integral",
      translations: {
        en: {
          title: "Properties of Definite Integral",
        },
        id: {
          title: "Sifat-Sifat Integral Tentu",
        },
      },
    },
    {
      slug: "properties-of-indefinite-integral",
      translations: {
        en: {
          title: "Properties of Indefinite Integral",
        },
        id: {
          title: "Sifat-Sifat Integral Tak Tentu",
        },
      },
    },
    {
      slug: "riemann-sum",
      translations: {
        en: {
          title: "Riemann Sum",
        },
        id: {
          title: "Jumlahan Riemann",
        },
      },
    },
  ],
});
