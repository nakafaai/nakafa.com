import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";

export const indonesiaMerdekaCurriculum = defineCurriculum({
  programKey: LEARNING_PROGRAM_KEYS.indonesiaMerdekaCurriculum,
  nodes: [
    {
      key: "class-10",
      level: "class",
      materialKeys: [],
      order: 100,
      translations: {
        en: {
          title: "Class 10",
        },
        id: {
          title: "Kelas 10",
        },
      },
    },
    {
      key: "class-10-biology",
      level: "subject",
      materialKeys: [],
      order: 10,
      parentKey: "class-10",
      translations: {
        en: {
          title: "Biology",
        },
        id: {
          title: "Biologi",
        },
      },
    },
    {
      key: "class-10-biology-biodiversity",
      level: "topic",
      materialKeys: ["lesson.biology.biodiversity"],
      order: 10,
      parentKey: "class-10-biology",
      translations: {
        en: {
          title: "Biodiversity of Living Organisms",
          description:
            "Recognize bacteria as prokaryotic cells with coccus, bacillus, spiral forms, nucleoids, ribosomes, cell walls, and roles in life.",
        },
        id: {
          title: "Keanekaragaman Makhluk Hidup",
          description:
            "Mengenali bakteri sebagai sel prokariotik dengan bentuk kokus, basilus, spiral, struktur nukleoid, ribosom, dinding sel, dan peran dalam kehidupan.",
        },
      },
    },
    {
      key: "class-10-biology-climate-change",
      level: "topic",
      materialKeys: ["lesson.biology.climate-change"],
      order: 20,
      parentKey: "class-10-biology",
      translations: {
        en: {
          title: "Climate Change",
          description:
            "Understand the greenhouse effect, greenhouse gases, fossil fuel combustion, land-use change, organic waste, plastic, and human activities that increase warming.",
        },
        id: {
          title: "Perubahan Iklim",
          description:
            "Memahami efek rumah kaca, gas rumah kaca, pembakaran bahan bakar fosil, perubahan lahan, limbah organik, plastik, dan aktivitas manusia yang meningkatkan pemanasan.",
        },
      },
    },
    {
      key: "class-10-biology-virus-role",
      level: "topic",
      materialKeys: ["lesson.biology.virus-role"],
      order: 30,
      parentKey: "class-10-biology",
      translations: {
        en: {
          title: "Viruses and Their Role",
          description:
            "Understand viral replication through lytic and lysogenic cycles, from attachment to the release of new virus particles.",
        },
        id: {
          title: "Virus dan Peranannya",
          description:
            "Memahami replikasi virus melalui siklus litik dan lisogenik, mulai dari penempelan sampai pelepasan partikel virus baru.",
        },
      },
    },
    {
      key: "class-10-chemistry",
      level: "subject",
      materialKeys: [],
      order: 20,
      parentKey: "class-10",
      translations: {
        en: {
          title: "Chemistry",
        },
        id: {
          title: "Kimia",
        },
      },
    },
    {
      key: "class-10-chemistry-basic-chemistry-laws",
      level: "topic",
      materialKeys: ["lesson.chemistry.basic-chemistry-laws"],
      order: 10,
      parentKey: "class-10-chemistry",
      translations: {
        en: {
          title: "Basic Laws of Chemistry",
          description:
            "Learn how to distinguish chemical changes from physical changes using gas, precipitates, color changes, and energy changes.",
        },
        id: {
          title: "Hukum Dasar Kimia",
          description:
            "Pelajari cara membedakan perubahan kimia dari perubahan fisika lewat gas, endapan, perubahan warna, dan perubahan energi.",
        },
      },
    },
    {
      key: "class-10-chemistry-green-chemistry",
      level: "topic",
      materialKeys: ["lesson.chemistry.green-chemistry"],
      order: 20,
      parentKey: "class-10-chemistry",
      translations: {
        en: {
          title: "Green Chemistry",
          description:
            "Read everyday chemical processes through atoms, elements, molecules, reaction equations, then judge whether the process fits green chemistry principles.",
        },
        id: {
          title: "Kimia Hijau",
          description:
            "Baca proses kimia di sekitar kita dari atom, unsur, molekul, persamaan reaksi, lalu cek apakah prosesnya selaras dengan prinsip kimia hijau.",
        },
      },
    },
    {
      key: "class-10-chemistry-structure-matter",
      level: "topic",
      materialKeys: ["lesson.chemistry.structure-matter"],
      order: 30,
      parentKey: "class-10-chemistry",
      translations: {
        en: {
          title: "Atomic Structure",
          description:
            "Start from a simple question about cutting matter again and again, then see why the atomic idea appeared before modern laboratory tools existed.",
        },
        id: {
          title: "Struktur Atom",
          description:
            "Mulai dari pertanyaan sederhana tentang benda yang dipotong terus-menerus, lalu lihat mengapa gagasan atom lahir sebelum alat laboratorium modern ada.",
        },
      },
    },
    {
      key: "class-10-mathematics",
      level: "subject",
      materialKeys: [],
      order: 30,
      parentKey: "class-10",
      translations: {
        en: {
          title: "Mathematics",
        },
        id: {
          title: "Matematika",
        },
      },
    },
    {
      key: "class-10-mathematics-exponential-logarithm",
      level: "topic",
      materialKeys: ["lesson.mathematics.exponential-logarithm"],
      order: 10,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Exponents and Logarithms",
          description:
            "Exponent notation connects repeated multiplication to patterns such as paper folding, viral spread, and zero, negative, or fractional powers.",
        },
        id: {
          title: "Eksponen dan Logaritma",
          description:
            "Eksponen menghubungkan perkalian berulang dengan pola lipatan kertas, penyebaran virus, serta pangkat nol, negatif, dan pecahan.",
        },
      },
    },
    {
      key: "class-10-mathematics-linear-equation-inequality",
      level: "topic",
      materialKeys: ["lesson.mathematics.linear-equation-inequality"],
      order: 20,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Systems of Linear Equations and Inequalities",
          description:
            "Learn solving linear equation systems with substitution and elimination methods. Learn real-world applications with worked examples and visual guides.",
        },
        id: {
          title: "Sistem Persamaan dan Pertidaksamaan Linear",
          description:
            "Pelajari cara menyelesaikan sistem persamaan linear dengan metode substitusi dan eliminasi melalui contoh aplikasi dan panduan visual.",
        },
      },
    },
    {
      key: "class-10-mathematics-probability",
      level: "topic",
      materialKeys: ["lesson.mathematics.probability"],
      order: 30,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Probability",
          description:
            "Learn probability addition rule for OR events. Learn mutually exclusive vs non-mutually exclusive events with clear examples, formulas, and worked solutions.",
        },
        id: {
          title: "Peluang",
          description:
            "Pelajari aturan penjumlahan peluang untuk kejadian ATAU. Bedakan kejadian saling lepas dan tidak saling lepas dengan contoh, rumus, dan pembahasan soal.",
        },
      },
    },
    {
      key: "class-10-mathematics-quadratic-function",
      level: "topic",
      materialKeys: ["lesson.mathematics.quadratic-function"],
      order: 40,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Quadratic Functions",
          description:
            "Learn how to solve quadratic equations with factorization, completing the square, and the quadratic formula through examples and practice questions.",
        },
        id: {
          title: "Persamaan dan Fungsi Kuadrat",
          description:
            "Pelajari cara menyelesaikan persamaan kuadrat dengan faktorisasi, melengkapkan kuadrat, dan rumus kuadrat melalui contoh dan soal praktis.",
        },
      },
    },
    {
      key: "class-10-mathematics-sequence-series",
      level: "topic",
      materialKeys: ["lesson.mathematics.sequence-series"],
      order: 50,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Sequence and Series",
          description:
            "Learn arithmetic sequences with worked examples, formulas, and real-world applications. Learn to find general terms and solve sequence problems.",
        },
        id: {
          title: "Barisan dan Deret",
          description:
            "Pelajari barisan aritmetika dengan contoh bertahap, rumus suku umum, dan aplikasi nyata. Pelajari konsep beda dan pola bilangan.",
        },
      },
    },
    {
      key: "class-10-mathematics-statistics-foundations",
      level: "topic",
      materialKeys: ["lesson.mathematics.statistics-foundations"],
      order: 60,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Statistics",
          description:
            "Learn when to use mean, median, or mode in statistics and how outliers affect each measure in real data.",
        },
        id: {
          title: "Statistika",
          description:
            "Pelajari kapan menggunakan mean, median, atau modus dalam statistika. Pahami pengaruh pencilan dan dapatkan panduan praktis analisis data.",
        },
      },
    },
    {
      key: "class-10-mathematics-trigonometry",
      level: "topic",
      materialKeys: ["lesson.mathematics.trigonometry"],
      order: 70,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Trigonometry",
          description:
            "Learn how to identify opposite, adjacent, and hypotenuse sides in right triangles. Learn the foundation of trigonometry with clear examples and visual guides.",
        },
        id: {
          title: "Trigonometri",
          description:
            "Pelajari cara mengidentifikasi sisi depan, samping, dan miring pada segitiga siku-siku. Pelajari dasar trigonometri dengan penjelasan jelas dan panduan visual.",
        },
      },
    },
    {
      key: "class-10-mathematics-vector-operations",
      level: "topic",
      materialKeys: ["lesson.mathematics.vector-operations"],
      order: 80,
      parentKey: "class-10-mathematics",
      translations: {
        en: {
          title: "Vector and Operations",
          description:
            "Learn column and row vector notation, transpose operations, unit vectors in Cartesian systems, and their applications in linear algebra calculations.",
        },
        id: {
          title: "Vektor dan Operasinya",
          description:
            "Pelajari notasi vektor kolom dan baris, operasi transpos, vektor satuan dalam sistem Kartesius, dan aplikasinya dalam perhitungan aljabar linear.",
        },
      },
    },
    {
      key: "class-10-physics",
      level: "subject",
      materialKeys: [],
      order: 40,
      parentKey: "class-10",
      translations: {
        en: {
          title: "Physics",
        },
        id: {
          title: "Fisika",
        },
      },
    },
    {
      key: "class-10-physics-measurement",
      level: "topic",
      materialKeys: ["lesson.physics.measurement"],
      order: 10,
      parentKey: "class-10-physics",
      translations: {
        en: {
          title: "Measurement in Scientific Work",
          description:
            "Learn physical dimensions as codes built from base quantities, how to derive dimensions of derived quantities, and how to check formulas without numbers.",
        },
        id: {
          title: "Pengukuran dalam Kerja Ilmiah",
          description:
            "Pelajari dimensi fisika sebagai kode penyusun besaran pokok, cara menurunkan dimensi besaran turunan, dan cara mengecek rumus tanpa angka.",
        },
      },
    },
    {
      key: "class-10-physics-renewable-energy",
      level: "topic",
      materialKeys: ["lesson.physics.renewable-energy"],
      order: 20,
      parentKey: "class-10-physics",
      translations: {
        en: {
          title: "Renewable Energy",
          description:
            "Learn what energy means in physics, how energy relates to work, joules, power, and how to read kWh in everyday electricity use.",
        },
        id: {
          title: "Energi Terbarukan",
          description:
            "Pelajari arti energi dalam fisika, hubungan energi dengan usaha, satuan joule, daya, dan cara membaca kWh pada pemakaian listrik sehari-hari.",
        },
      },
    },
    {
      key: "class-11",
      level: "class",
      materialKeys: [],
      order: 110,
      translations: {
        en: {
          title: "Class 11",
        },
        id: {
          title: "Kelas 11",
        },
      },
    },
    {
      key: "class-11-mathematics",
      level: "subject",
      materialKeys: [],
      order: 30,
      parentKey: "class-11",
      translations: {
        en: {
          title: "Mathematics",
        },
        id: {
          title: "Matematika",
        },
      },
    },
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
      materialKeys: [
        "lesson.mathematics.function-composition-inverse-function",
      ],
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
      key: "class-11-physics",
      level: "subject",
      materialKeys: [],
      order: 40,
      parentKey: "class-11",
      translations: {
        en: {
          title: "Physics",
        },
        id: {
          title: "Fisika",
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
    {
      key: "class-12",
      level: "class",
      materialKeys: [],
      order: 120,
      translations: {
        en: {
          title: "Class 12",
        },
        id: {
          title: "Kelas 12",
        },
      },
    },
    {
      key: "class-12-mathematics",
      level: "subject",
      materialKeys: [],
      order: 30,
      parentKey: "class-12",
      translations: {
        en: {
          title: "Mathematics",
        },
        id: {
          title: "Matematika",
        },
      },
    },
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
  ],
});
