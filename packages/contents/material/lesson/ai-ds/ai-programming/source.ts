import { defineLessonMaterial } from "@repo/contents/_types/material/schema";

export const lessonAiDsAiProgrammingMaterial = defineLessonMaterial({
  assetRoot: "material/lesson/ai-ds/ai-programming",
  domain: "ai-ds",
  key: "lesson.ai-ds.ai-programming",
  kind: "lesson",
  slug: "ai-programming",
  routeSlugs: { en: "ai-programming", id: "pemrograman-ai" },
  translations: {
    en: {
      description: "Use Python arithmetic operators with correct precedence.",
      title: "AI Programming",
    },
    id: {
      description: "Gunakan operator aritmatika Python dengan urutan tepat.",
      title: "Pemrograman AI",
    },
  },
  sections: [
    {
      slug: "arithmetic-operator",
      routeSlugs: { en: "arithmetic-operator", id: "operator-aritmatika" },
      translations: {
        en: {
          title: "Arithmetic Operators",
        },
        id: {
          title: "Operator Aritmatika",
        },
      },
    },
    {
      slug: "array-numpy",
      routeSlugs: { en: "array-numpy", id: "membuat-array-dengan-numpy" },
      translations: {
        en: {
          title: "Creating Arrays with NumPy",
        },
        id: {
          title: "Membuat Array dengan NumPy",
        },
      },
    },
    {
      slug: "array-operation-numpy",
      routeSlugs: {
        en: "array-operation-numpy",
        id: "operasi-pada-array-dengan-numpy",
      },
      translations: {
        en: {
          title: "Array Operations with NumPy",
        },
        id: {
          title: "Operasi pada Array dengan NumPy",
        },
      },
    },
    {
      slug: "attribute-data-type-numpy",
      routeSlugs: {
        en: "attribute-data-type-numpy",
        id: "atribut-dan-tipe-data-dengan-numpy",
      },
      translations: {
        en: {
          title: "Attributes and Data Types with NumPy",
        },
        id: {
          title: "Atribut dan Tipe Data dengan NumPy",
        },
      },
    },
    {
      slug: "comparison-logic",
      routeSlugs: { en: "comparison-logic", id: "perbandingan-dan-logika" },
      translations: {
        en: {
          title: "Comparison and Logic",
        },
        id: {
          title: "Perbandingan dan Logika",
        },
      },
    },
    {
      slug: "container",
      routeSlugs: { en: "container", id: "container" },
      translations: {
        en: {
          title: "Containers",
        },
        id: {
          title: "Container",
        },
      },
    },
    {
      slug: "control-flow",
      routeSlugs: { en: "control-flow", id: "control-flow" },
      translations: {
        en: {
          title: "Control Flow",
        },
        id: {
          title: "Control Flow",
        },
      },
    },
    {
      slug: "dictionary",
      routeSlugs: { en: "dictionary", id: "dictionary" },
      translations: {
        en: {
          title: "Dictionary",
        },
        id: {
          title: "Dictionary",
        },
      },
    },
    {
      slug: "escape-sequence",
      routeSlugs: { en: "escape-sequence", id: "escape-sequence" },
      translations: {
        en: {
          title: "Escape Sequence",
        },
        id: {
          title: "Escape Sequence",
        },
      },
    },
    {
      slug: "everything-object-python",
      routeSlugs: {
        en: "everything-object-python",
        id: "semuanya-adalah-objek-di-python",
      },
      translations: {
        en: {
          title: "Everything is an Object in Python",
        },
        id: {
          title: "Semuanya adalah Objek di Python",
        },
      },
    },
    {
      slug: "file-input-output",
      routeSlugs: { en: "file-input-output", id: "file-input-dan-output" },
      translations: {
        en: {
          title: "File Input and Output",
        },
        id: {
          title: "File Input dan Output",
        },
      },
    },
    {
      slug: "function",
      routeSlugs: { en: "function", id: "fungsi" },
      translations: {
        en: {
          title: "Functions",
        },
        id: {
          title: "Fungsi",
        },
      },
    },
    {
      slug: "immutable-mutable-identity",
      routeSlugs: {
        en: "immutable-mutable-identity",
        id: "immutable-mutable-dan-identity",
      },
      translations: {
        en: {
          title: "Immutable, Mutable, and Identity",
        },
        id: {
          title: "Immutable, Mutable, dan Identity",
        },
      },
    },
    {
      slug: "indexing-slicing",
      routeSlugs: { en: "indexing-slicing", id: "indexing-dan-slicing" },
      translations: {
        en: {
          title: "Indexing and Slicing",
        },
        id: {
          title: "Indexing dan Slicing",
        },
      },
    },
    {
      slug: "indexing-slicing-numpy",
      routeSlugs: {
        en: "indexing-slicing-numpy",
        id: "indexing-dan-slicing-dengan-numpy",
      },
      translations: {
        en: {
          title: "Indexing and Slicing with NumPy",
        },
        id: {
          title: "Indexing dan Slicing dengan NumPy",
        },
      },
    },
    {
      slug: "iterable",
      routeSlugs: { en: "iterable", id: "iterable" },
      translations: {
        en: {
          title: "Iterables",
        },
        id: {
          title: "Iterable",
        },
      },
    },
    {
      slug: "markdown-cli",
      routeSlugs: {
        en: "markdown-cli",
        id: "markdown-dan-command-line-interfaces",
      },
      translations: {
        en: {
          title: "Markdown and Command Line Interfaces",
        },
        id: {
          title: "Markdown dan Command Line Interfaces",
        },
      },
    },
    {
      slug: "math-function",
      routeSlugs: { en: "math-function", id: "fungsi-matematika" },
      translations: {
        en: {
          title: "Mathematical Functions",
        },
        id: {
          title: "Fungsi Matematika",
        },
      },
    },
    {
      slug: "number-attribute-method",
      routeSlugs: {
        en: "number-attribute-method",
        id: "atribut-dan-metode-bilangan",
      },
      translations: {
        en: {
          title: "Number Attributes and Methods",
        },
        id: {
          title: "Atribut dan Metode Bilangan",
        },
      },
    },
    {
      slug: "numbers",
      routeSlugs: { en: "numbers", id: "numbers" },
      translations: {
        en: {
          title: "Numbers",
        },
        id: {
          title: "Numbers",
        },
      },
    },
    {
      slug: "print-function",
      routeSlugs: { en: "print-function", id: "fungsi-print" },
      translations: {
        en: {
          title: "Print Function",
        },
        id: {
          title: "Fungsi Print",
        },
      },
    },
    {
      slug: "python-step-1",
      routeSlugs: { en: "python-step-1", id: "step-pertama-di-python" },
      translations: {
        en: {
          title: "First Steps in Python",
        },
        id: {
          title: "Step Pertama di Python",
        },
      },
    },
    {
      slug: "string-formatting",
      routeSlugs: { en: "string-formatting", id: "pemformatan-string" },
      translations: {
        en: {
          title: "String Formatting",
        },
        id: {
          title: "Pemformatan String",
        },
      },
    },
    {
      slug: "string-method",
      routeSlugs: { en: "string-method", id: "metode-string" },
      translations: {
        en: {
          title: "String Methods",
        },
        id: {
          title: "Metode String",
        },
      },
    },
    {
      slug: "string-object",
      routeSlugs: { en: "string-object", id: "objek-string" },
      translations: {
        en: {
          title: "String Objects",
        },
        id: {
          title: "Objek String",
        },
      },
    },
    {
      slug: "syntactic-sugar",
      routeSlugs: { en: "syntactic-sugar", id: "syntactic-sugar" },
      translations: {
        en: {
          title: "Syntactic Sugar",
        },
        id: {
          title: "Syntactic Sugar",
        },
      },
    },
    {
      slug: "variable",
      routeSlugs: { en: "variable", id: "variabel" },
      translations: {
        en: {
          title: "Variables",
        },
        id: {
          title: "Variabel",
        },
      },
    },
  ],
});
