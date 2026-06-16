import type { CurriculumNodeInput } from "@repo/contents/_types/curriculum/schema";

export const merdekaClass12TopicNodes = [
  {
    key: "class-12-mathematics-analytic-geometry",
    level: "topic",
    materialKeys: ["lesson.mathematics.analytic-geometry"],
    order: 10,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Analytic Geometry",
        description:
          "Learn circle fundamentals such as center, radius, and equations, then derive (x-a)² + (y-b)² = r² with examples.",
      },
      id: {
        title: "Geometri Analitik",
        description:
          "Pelajari konsep dasar lingkaran dengan penjelasan pusat, jari-jari, dan persamaan. Pahami cara menurunkan (x-a)² + (y-b)² = r² dengan contoh interaktif.",
      },
    },
  },
  {
    key: "class-12-mathematics-circle-arc-sector",
    level: "topic",
    materialKeys: ["lesson.mathematics.circle-arc-sector"],
    order: 20,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Circle Arcs and Sectors",
        description:
          "Learn circle arcs, arc length formulas, and central angle relationships. Learn minor, major, and semicircular arcs with worked examples.",
      },
      id: {
        title: "Busur dan Juring Lingkaran",
        description:
          "Pelajari busur lingkaran, rumus panjang busur, dan hubungan dengan sudut pusat. Pahami busur kecil, besar, dan setengah lingkaran lewat contoh soal.",
      },
    },
  },
  {
    key: "class-12-mathematics-combinatorics",
    level: "topic",
    materialKeys: ["lesson.mathematics.combinatorics"],
    order: 30,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Combinatorics",
        description:
          "Learn binomial theorem to expand (x+y)^n quickly. Learn coefficients, constant terms, and problem-solving with worked examples and practice problems.",
      },
      id: {
        title: "Kombinatorik",
        description:
          "Pelajari teorema binomial untuk mengembangkan (x+y)^n dengan cepat. Pahami koefisien, suku konstanta, dan strategi penyelesaian lewat contoh serta latihan.",
      },
    },
  },
  {
    key: "class-12-mathematics-data-analysis-probability",
    level: "topic",
    materialKeys: ["lesson.mathematics.data-analysis-probability"],
    order: 40,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Data Analysis and Probability",
        description:
          "Learn binomial distribution formula with worked examples. Calculate probability of success in repeated trials with coin flips and practice problems.",
      },
      id: {
        title: "Analisis Data dan Peluang",
        description:
          "Pelajari rumus distribusi binomial untuk menghitung peluang keberhasilan dalam percobaan berulang dan latihan soal.",
      },
    },
  },
  {
    key: "class-12-mathematics-derivative-function",
    level: "topic",
    materialKeys: ["lesson.mathematics.derivative-function"],
    order: 50,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Derivative Functions",
        description:
          "Learn how derivatives solve real-world physics problems. Calculate velocity, acceleration, and maximum heights with worked examples and formulas.",
      },
      id: {
        title: "Turunan Fungsi",
        description:
          "Pelajari cara turunan memecahkan masalah fisika nyata. Hitung kecepatan, percepatan, dan ketinggian maksimum dengan contoh dan rumus bertahap.",
      },
    },
  },
  {
    key: "class-12-mathematics-function-transformation",
    level: "topic",
    materialKeys: ["lesson.mathematics.function-transformation"],
    order: 60,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Function Transformation",
        description:
          "Learn combined function transformations with worked examples. Learn vertical, horizontal transformations, order effects, and solve practice exercises.",
      },
      id: {
        title: "Transformasi Fungsi",
        description:
          "Pelajari kombinasi transformasi fungsi dengan contoh bertahap. Pelajari transformasi vertikal, horizontal, pengaruh urutan, dan kerjakan latihan soal.",
      },
    },
  },
  {
    key: "class-12-mathematics-integral",
    level: "topic",
    materialKeys: ["lesson.mathematics.integral"],
    order: 70,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Integrals",
        description:
          "Calculate flat surface areas using definite integrals with worked solutions. Learn quadratic and irrational functions through practical examples.",
      },
      id: {
        title: "Integral",
        description:
          "Hitung luas bidang datar menggunakan integral tentu dengan solusi bertahap. Pelajari fungsi kuadrat dan irasional melalui contoh praktis.",
      },
    },
  },
  {
    key: "class-12-mathematics-limit",
    level: "topic",
    materialKeys: ["lesson.mathematics.limit"],
    order: 80,
    parentKey: "class-12-mathematics",
    translations: {
      en: {
        title: "Limits",
        description:
          "Apply limits to real-world scenarios: disease spread analysis, vaccination strategies, economic models, and marginal cost calculations with examples.",
      },
      id: {
        title: "Limit",
        description:
          "Terapkan limit pada skenario dunia nyata: analisis penyebaran penyakit, strategi vaksinasi, model ekonomi, dan perhitungan biaya marginal dengan contoh.",
      },
    },
  },
] satisfies readonly CurriculumNodeInput[];
