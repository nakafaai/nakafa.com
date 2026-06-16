import type { CurriculumNodeInput } from "@repo/contents/_types/curriculum/schema";

export const merdekaClass11TopicNodes = [
  {
    key: "class-11-mathematics-circle",
    level: "topic",
    materialKeys: ["lesson.mathematics.circle"],
    order: 10,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Circle",
        description:
          "Learn central and inscribed angles in circles. Learn the key relationship, theorems, and solve problems with worked examples and proofs.",
      },
      id: {
        title: "Lingkaran",
        description:
          "Pelajari sudut pusat dan keliling lingkaran. Pahami hubungan, teorema, dan cara menghitung dengan contoh soal dan pembuktian matematis.",
      },
    },
  },
  {
    key: "class-11-mathematics-complex-number",
    level: "topic",
    materialKeys: ["lesson.mathematics.complex-number"],
    order: 20,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Complex Number",
        description:
          "Learn how to add complex numbers one step at a time with geometric visualization. Learn real and imaginary parts addition using parallelogram rule and examples.",
      },
      id: {
        title: "Bilangan Kompleks",
        description:
          "Pelajari cara menjumlahkan bilangan kompleks secara bertahap dengan visualisasi geometris. Pahami penjumlahan bagian real dan imajiner lewat aturan jajar genjang dan contoh.",
      },
    },
  },
  {
    key: "class-11-mathematics-function-composition-inverse-function",
    level: "topic",
    materialKeys: ["lesson.mathematics.function-composition-inverse-function"],
    order: 30,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Function Composition and Inverse Function",
        description:
          "Learn how to add and subtract functions one step at a time with domain intersection rules. Learn function operations through clear examples and practice problems.",
      },
      id: {
        title: "Fungsi Komposisi dan Fungsi Invers",
        description:
          "Pelajari cara menjumlahkan dan mengurangkan fungsi dengan aturan irisan domain melalui contoh jelas dan soal latihan.",
      },
    },
  },
  {
    key: "class-11-mathematics-function-modeling",
    level: "topic",
    materialKeys: ["lesson.mathematics.function-modeling"],
    order: 40,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Functions and Their Modeling",
        description:
          "Learn absolute value functions with interactive graphs, transformations, and worked solutions. Learn properties, equations, and real applications.",
      },
      id: {
        title: "Fungsi dan Pemodelannya",
        description:
          "Pelajari fungsi nilai mutlak dengan grafik interaktif, transformasi, dan solusi bertahap. Pahami sifat, persamaan, dan aplikasi nyata.",
      },
    },
  },
  {
    key: "class-11-mathematics-geometric-transformation",
    level: "topic",
    materialKeys: ["lesson.mathematics.geometric-transformation"],
    order: 50,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Geometric Transformation",
        description:
          "Learn composite transformation matrices with worked examples. Combine reflections, rotations, and dilations using matrix multiplication.",
      },
      id: {
        title: "Transformasi Geometri",
        description:
          "Pelajari matriks transformasi komposisi dengan contoh perhitungan. Gabungkan refleksi, rotasi, dan dilatasi menggunakan perkalian matriks.",
      },
    },
  },
  {
    key: "class-11-mathematics-matrix",
    level: "topic",
    materialKeys: ["lesson.mathematics.matrix"],
    order: 60,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Matrix",
        description:
          "Learn cofactor expansion for matrix determinants through minors, cofactors, and clear calculation examples.",
      },
      id: {
        title: "Matriks",
        description:
          "Pelajari metode ekspansi kofaktor untuk menghitung determinan matriks. Pahami minor, kofaktor, dan perhitungan determinan dengan contoh.",
      },
    },
  },
  {
    key: "class-11-mathematics-polynomial",
    level: "topic",
    materialKeys: ["lesson.mathematics.polynomial"],
    order: 70,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Polynomial",
        description:
          "Learn polynomial addition and subtraction with worked examples. Understand like terms, horizontal and vertical methods, plus graphical visualization.",
      },
      id: {
        title: "Polinomial",
        description:
          "Pelajari penjumlahan dan pengurangan polinomial dengan contoh bertahap. Pahami suku sejenis, metode horizontal dan vertikal, serta visualisasi grafik.",
      },
    },
  },
  {
    key: "class-11-mathematics-statistics-regression",
    level: "topic",
    materialKeys: ["lesson.mathematics.statistics-regression"],
    order: 80,
    parentKey: "class-11-mathematics",
    translations: {
      en: {
        title: "Statistics",
        description:
          "Learn how r² measures how well your regression line explains data variation. Learn coefficient of determination with visual examples and calculations.",
      },
      id: {
        title: "Statistika",
        description:
          "Pelajari bagaimana r² mengukur seberapa baik garis regresi menjelaskan variasi data. Pahami koefisien determinasi dengan contoh visual dan perhitungan.",
      },
    },
  },
  {
    key: "class-11-physics-kinematics",
    level: "topic",
    materialKeys: ["lesson.physics.kinematics"],
    order: 10,
    parentKey: "class-11-physics",
    translations: {
      en: {
        title: "Kinematics",
        description:
          "Learn acceleration as the change in velocity over time through motion traces, velocity-time graphs, and simple calculations.",
      },
      id: {
        title: "Kinematika",
        description:
          "Pelajari percepatan sebagai perubahan kecepatan terhadap waktu melalui jejak gerak, grafik kecepatan-waktu, dan perhitungan sederhana.",
      },
    },
  },
  {
    key: "class-11-physics-vector",
    level: "topic",
    materialKeys: ["lesson.physics.vector"],
    order: 20,
    parentKey: "class-11-physics",
    translations: {
      en: {
        title: "Vector",
        description:
          "Learn how to add and subtract vectors using x and y components, then determine the resultant magnitude and direction.",
      },
      id: {
        title: "Vektor",
        description:
          "Pelajari cara menjumlahkan dan mengurangkan vektor dengan komponen x dan y, lalu menentukan besar serta arah resultan.",
      },
    },
  },
] satisfies readonly CurriculumNodeInput[];
