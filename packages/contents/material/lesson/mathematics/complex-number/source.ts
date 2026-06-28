import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonMathematicsComplexNumberMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/mathematics/complex-number",
  domain: "mathematics",
  key: "lesson.mathematics.complex-number",
  kind: "lesson",
  slug: "complex-number",
  routeSlugs: { en: "complex-number", id: "bilangan-kompleks" },
  translations: {
    en: {
      description: "Add complex numbers with real-imaginary geometry.",
      title: "Complex Number",
    },
    id: {
      description: "Jumlahkan bilangan kompleks lewat geometri bidang.",
      title: "Bilangan Kompleks",
    },
  },
  sections: [
    {
      slug: "addition-complex-numbers",
      routeSlugs: {
        en: "addition-complex-numbers",
        id: "penjumlahan-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Addition of Complex Numbers",
        },
        id: {
          title: "Penjumlahan Bilangan Kompleks",
        },
      },
    },
    {
      slug: "complex-number-concept",
      routeSlugs: {
        en: "complex-number-concept",
        id: "konsep-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Complex Number Concept",
        },
        id: {
          title: "Konsep Bilangan Kompleks",
        },
      },
    },
    {
      slug: "complex-number-form",
      routeSlugs: { en: "complex-number-form", id: "bentuk-bilangan-kompleks" },
      translations: {
        en: {
          title: "Complex Number Form",
        },
        id: {
          title: "Bentuk Bilangan Kompleks",
        },
      },
    },
    {
      slug: "conjugate-complex-numbers",
      routeSlugs: {
        en: "conjugate-complex-numbers",
        id: "konjugat-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Complex Number Conjugate",
        },
        id: {
          title: "Konjugat Bilangan Kompleks",
        },
      },
    },
    {
      slug: "inverse-complex-numbers",
      routeSlugs: {
        en: "inverse-complex-numbers",
        id: "invers-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Inverse of Complex Numbers",
        },
        id: {
          title: "Invers Bilangan Kompleks",
        },
      },
    },
    {
      slug: "modulus-argument-complex-numbers",
      routeSlugs: {
        en: "modulus-argument-complex-numbers",
        id: "modulus-dan-argumen-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Modulus and Argument of Complex Numbers",
        },
        id: {
          title: "Modulus dan Argumen Bilangan Kompleks",
        },
      },
    },
    {
      slug: "multiplication-complex-numbers",
      routeSlugs: {
        en: "multiplication-complex-numbers",
        id: "perkalian-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Multiplication of Complex Numbers",
        },
        id: {
          title: "Perkalian Bilangan Kompleks",
        },
      },
    },
    {
      slug: "principal-argument-complex-numbers",
      routeSlugs: {
        en: "principal-argument-complex-numbers",
        id: "argumen-utama-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Principal Argument of Complex Numbers",
        },
        id: {
          title: "Argumen Utama Bilangan Kompleks",
        },
      },
    },
    {
      slug: "properties-addition-complex-numbers",
      routeSlugs: {
        en: "properties-addition-complex-numbers",
        id: "sifat-penjumlahan-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Properties of Addition of Complex Numbers",
        },
        id: {
          title: "Sifat Penjumlahan Bilangan Kompleks",
        },
      },
    },
    {
      slug: "properties-modulus-complex-numbers",
      routeSlugs: {
        en: "properties-modulus-complex-numbers",
        id: "sifat-operasi-modulus-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Properties of Complex Number Modulus",
        },
        id: {
          title: "Sifat Operasi Modulus Bilangan Kompleks",
        },
      },
    },
    {
      slug: "properties-multiplication-complex-numbers",
      routeSlugs: {
        en: "properties-multiplication-complex-numbers",
        id: "sifat-perkalian-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Properties of Multiplication of Complex Numbers",
        },
        id: {
          title: "Sifat Perkalian Bilangan Kompleks",
        },
      },
    },
    {
      slug: "properties-principal-argument-complex-numbers",
      routeSlugs: {
        en: "properties-principal-argument-complex-numbers",
        id: "sifat-argumen-utama-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Properties of Principal Argument of Complex Numbers",
        },
        id: {
          title: "Sifat Argumen Utama Bilangan Kompleks",
        },
      },
    },
    {
      slug: "scalar-multiplication-complex-numbers",
      routeSlugs: {
        en: "scalar-multiplication-complex-numbers",
        id: "perkalian-skalar-bilangan-kompleks",
      },
      translations: {
        en: {
          title: "Scalar Multiplication of Complex Numbers",
        },
        id: {
          title: "Perkalian Skalar Bilangan Kompleks",
        },
      },
    },
  ],
});
