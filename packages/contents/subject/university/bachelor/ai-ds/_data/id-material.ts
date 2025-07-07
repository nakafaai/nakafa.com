import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Metode Linear AI",
    description:
      "Tulang punggung matematika yang mengubah pola data menjadi prediksi cerdas.",
    href: `${BASE_PATH}/linear-methods`,
    items: [
      {
        title: "Definisi Determinan",
        href: `${BASE_PATH}/linear-methods/determinant`,
      },
      {
        title: "Perhitungan Determinan",
        href: `${BASE_PATH}/linear-methods/determinant-calculation`,
      },
      {
        title: "Teorema pengembangan Laplace",
        href: `${BASE_PATH}/linear-methods/laplace-expansion`,
      },
      {
        title: "Aturan Cramer",
        href: `${BASE_PATH}/linear-methods/cramer-rule`,
      },
      {
        title: "Ruang Vektor Kompleks",
        href: `${BASE_PATH}/linear-methods/complex-vector-space`,
      },
      {
        title: "Matriks Kompleks",
        href: `${BASE_PATH}/linear-methods/complex-matrix`,
      },
      {
        title: "Nilai Eigen, Vektor Eigen, dan Ruang Eigen",
        href: `${BASE_PATH}/linear-methods/eigenvalue-eigenvector-eigenspace`,
      },
      {
        title: "Karakteristik Polinomial",
        href: `${BASE_PATH}/linear-methods/characteristic-polynomial`,
      },
      {
        title: "Nilai Eigen dari Matriks Diagonal dan Segitiga",
        href: `${BASE_PATH}/linear-methods/eigenvalue-diagonal-matrix`,
      },
      {
        title: "Matriks Ortogonal dan Uniter",
        href: `${BASE_PATH}/linear-methods/orthogonal-unitary-matrix`,
      },
      {
        title: "Matriks simetris dan Hermitian",
        href: `${BASE_PATH}/linear-methods/symmetric-hermitian-matrix`,
      },
      {
        title: "Matriks Definit Positif",
        href: `${BASE_PATH}/linear-methods/positive-definite-matrix`,
      },
      {
        title: "Produk Skalar",
        href: `${BASE_PATH}/linear-methods/scalar-product`,
      },
      {
        title: "Kondisi Matriks",
        href: `${BASE_PATH}/linear-methods/matrix-condition`,
      },
      {
        title: "LU Dekomposisi",
        href: `${BASE_PATH}/linear-methods/lu-decomposition`,
      },
      {
        title: "Cholesky Dekomposisi",
        href: `${BASE_PATH}/linear-methods/cholesky-decomposition`,
      },
      {
        title: "QR Dekomposisi",
        href: `${BASE_PATH}/linear-methods/qr-decomposition`,
      },
      {
        title: "Linear Model",
        href: `${BASE_PATH}/linear-methods/linear-model`,
      },
      {
        title: "Sistem Persamaan Linear",
        href: `${BASE_PATH}/linear-methods/system-linear-equation`,
      },
      {
        title: "Masalah Keseimbangan Linear",
        href: `${BASE_PATH}/linear-methods/linear-equilibrium-problem`,
      },
      {
        title: "Sistem Persamaan Normal",
        href: `${BASE_PATH}/linear-methods/normal-equation`,
      },
      {
        title: "Solusi Sistem Persamaan Normal",
        href: `${BASE_PATH}/linear-methods/normal-equation-solution`,
      },
      {
        title: "Kemampuan Identifikasi dan Pemeringkatan",
        href: `${BASE_PATH}/linear-methods/identifiability-ranking`,
      },
      {
        title: "Regularisasi",
        href: `${BASE_PATH}/linear-methods/regularization`,
      },
      {
        title: "Analisis Statistik",
        href: `${BASE_PATH}/linear-methods/statistical-analysis`,
      },
      {
        title: "Perkiraan Terbaik dalam Fungsi dan Ruang Polinomial",
        href: `${BASE_PATH}/linear-methods/approximation-function-polynomial`,
      },
      {
        title: "Proyeksi Ortogonal",
        href: `${BASE_PATH}/linear-methods/orthogonal-projection`,
      },
      {
        title: "Polinomial Ortogonal",
        href: `${BASE_PATH}/linear-methods/orthogonal-polynomials`,
      },
      {
        title: "Kesamaan Matriks",
        href: `${BASE_PATH}/linear-methods/matrix-equality`,
      },
      {
        title: "Diagonalisasi Matriks",
        href: `${BASE_PATH}/linear-methods/diagonalization-matrix`,
      },
      {
        title: "Prosedur Dasar untuk Diagonalisasi",
        href: `${BASE_PATH}/linear-methods/diagonalization-procedure`,
      },
      {
        title: "Teorema Spektral",
        href: `${BASE_PATH}/linear-methods/spectral-theorem`,
      },
      {
        title: "Teorema Spektral untuk Matriks Kompleks",
        href: `${BASE_PATH}/linear-methods/spectral-complex-matrix`,
      },
      {
        title: "Teorema Spektral untuk Matriks Nyata",
        href: `${BASE_PATH}/linear-methods/spectral-real-matrix`,
      },
      {
        title: "Transformasi Sumbu Nyata",
        href: `${BASE_PATH}/linear-methods/real-axis-transformation`,
      },
      {
        title: "Contoh Analisis Komponen Utama",
        href: `${BASE_PATH}/linear-methods/principal-component-analysis`,
      },
      {
        title: "Trigonalisasi dan Bentuk Normal Jordan",
        href: `${BASE_PATH}/linear-methods/jordan-normal-form`,
      },
      {
        title: "Perhitungan Numerik dari Nilai Eigen",
        href: `${BASE_PATH}/linear-methods/numerical-eigenvalue-calculation`,
      },
      {
        title: "Perhitungan Nilai Eigen Individu",
        href: `${BASE_PATH}/linear-methods/individual-eigenvalue-calculation`,
      },
      {
        title: "Perhitungan Semua Nilai Eigen",
        href: `${BASE_PATH}/linear-methods/all-eigenvalues-calculation`,
      },
    ],
  },
  {
    title: "Pemrograman AI",
    description:
      "Mengkode kecerdasan yang mengajarkan mesin berpikir dan memecahkan masalah kompleks.",
    href: `${BASE_PATH}/ai-programming`,
    items: [
      {
        title: "Markdown dan Command Line Interfaces",
        href: `${BASE_PATH}/ai-programming/markdown-cli`,
      },
      {
        title: "Step Pertama di Python",
        href: `${BASE_PATH}/ai-programming/python-step-1`,
      },
      {
        title: "Semuanya adalah Objek di Python",
        href: `${BASE_PATH}/ai-programming/everything-object-python`,
      },
      {
        title: "Numbers",
        href: `${BASE_PATH}/ai-programming/numbers`,
      },
      {
        title: "Operator Aritmatika",
        href: `${BASE_PATH}/ai-programming/arithmetic-operator`,
      },
      {
        title: "Atribut dan Metode Bilangan",
        href: `${BASE_PATH}/ai-programming/number-attribute-method`,
      },
      {
        title: "Fungsi Matematika",
        href: `${BASE_PATH}/ai-programming/math-function`,
      },
      {
        title: "Variabel",
        href: `${BASE_PATH}/ai-programming/variable`,
      },
      {
        title: "Perbandingan dan Logika",
        href: `${BASE_PATH}/ai-programming/comparison-logic`,
      },
      {
        title: "Objek String",
        href: `${BASE_PATH}/ai-programming/string-object`,
      },
      {
        title: "Escape Sequence",
        href: `${BASE_PATH}/ai-programming/escape-sequence`,
      },
      {
        title: "Indexing dan Slicing",
        href: `${BASE_PATH}/ai-programming/indexing-slicing`,
      },
      {
        title: "Metode String",
        href: `${BASE_PATH}/ai-programming/string-method`,
      },
      {
        title: "Fungsi Print",
        href: `${BASE_PATH}/ai-programming/print-function`,
      },
      {
        title: "Pemformatan String",
        href: `${BASE_PATH}/ai-programming/string-formatting`,
      },
      {
        title: "Container",
        href: `${BASE_PATH}/ai-programming/container`,
      },
      {
        title: "Immutable, Mutable, dan Identity",
        href: `${BASE_PATH}/ai-programming/immutable-mutable-identity`,
      },
      {
        title: "Iterable",
        href: `${BASE_PATH}/ai-programming/iterable`,
      },
      {
        title: "Control Flow",
        href: `${BASE_PATH}/ai-programming/control-flow`,
      },
      {
        title: "File Input dan Output",
        href: `${BASE_PATH}/ai-programming/file-input-output`,
      },
      {
        title: "Dictionary",
        href: `${BASE_PATH}/ai-programming/dictionary`,
      },
      {
        title: "Fungsi",
        href: `${BASE_PATH}/ai-programming/function`,
      },
      {
        title: "Membuat Array dengan NumPy",
        href: `${BASE_PATH}/ai-programming/array-numpy`,
      },
      {
        title: "Atribut dan Tipe Data dengan NumPy",
        href: `${BASE_PATH}/ai-programming/attribute-data-type-numpy`,
      },
      {
        title: "Indexing dan Slicing dengan NumPy",
        href: `${BASE_PATH}/ai-programming/indexing-slicing-numpy`,
      },
      {
        title: "Operasi pada Array dengan NumPy",
        href: `${BASE_PATH}/ai-programming/array-operation-numpy`,
      },
      {
        title: "Syntactic Sugar",
        href: `${BASE_PATH}/ai-programming/syntactic-sugar`,
      },
    ],
  },
  {
    title: "Neural Networks",
    description:
      "Otak digital yang meniru neuron manusia untuk mengenali pola dan membuat keputusan.",
    href: `${BASE_PATH}/neural-networks`,
    items: [
      {
        title: "Masalah dari Supervised Learning",
        href: `${BASE_PATH}/neural-networks/problem-supervised-learning`,
      },
      {
        title: "Jenis-jenis Supervised Learning",
        href: `${BASE_PATH}/neural-networks/type-supervised-learning`,
      },
      {
        title: "Regresi Linear",
        href: `${BASE_PATH}/neural-networks/linear-regression`,
      },
      {
        title: "Ruang Fungsi",
        href: `${BASE_PATH}/neural-networks/function-space`,
      },
      {
        title: "Fungsi Kerugian",
        href: `${BASE_PATH}/neural-networks/loss-function`,
      },
      {
        title: "Persamaan Normal",
        href: `${BASE_PATH}/neural-networks/normal-equation`,
      },
      {
        title: "Fungsi Dasar Linear",
        href: `${BASE_PATH}/neural-networks/basic-linear-function`,
      },
      {
        title: "Pengklasifikasi Biner",
        href: `${BASE_PATH}/neural-networks/binary-classifier`,
      },
      {
        title: "Kerugian Entropi Silang Biner",
        href: `${BASE_PATH}/neural-networks/binary-cross-entropy-loss`,
      },
      {
        title: "Optimasi",
        href: `${BASE_PATH}/neural-networks/optimization`,
      },
      {
        title: "Pengklasifikasi Multi-Kelas",
        href: `${BASE_PATH}/neural-networks/multi-class-classifier`,
      },
      {
        title: "Kerugian Entropi Silang",
        href: `${BASE_PATH}/neural-networks/cross-entropy-loss`,
      },
      {
        title: "Persepsi Multi-Lapisan",
        href: `${BASE_PATH}/neural-networks/multi-layer-perceptron`,
      },
      {
        title: "Turunan Parsial",
        href: `${BASE_PATH}/neural-networks/partial-derivative`,
      },
      {
        title: "Contoh Penggunaan Turunan Parsial",
        href: `${BASE_PATH}/neural-networks/partial-derivative-example`,
      },
      {
        title: "Learning dalam Bentuk Vektor",
        href: `${BASE_PATH}/neural-networks/learning-vector`,
      },
      {
        title: "Fungsi Aktivasi untuk Lapisan Tersembunyi",
        href: `${BASE_PATH}/neural-networks/hidden-layer-activation-function`,
      },
      {
        title: "Tantangan Optimasi",
        href: `${BASE_PATH}/neural-networks/optimization-challenge`,
      },
      {
        title: "Varian Keturunan Gradien",
        href: `${BASE_PATH}/neural-networks/gradient-descent-variant`,
      },
      {
        title: "Laju Pembelajaran Adaptif",
        href: `${BASE_PATH}/neural-networks/adaptive-learning-rate`,
      },
      {
        title: "Rata-Rata Tertimbang Eksponensial",
        href: `${BASE_PATH}/neural-networks/exponential-weighted-average`,
      },
      {
        title: "Momentum",
        href: `${BASE_PATH}/neural-networks/momentum`,
      },
      {
        title: "Propagasi Akar Rata-Rata Kuadrat",
        href: `${BASE_PATH}/neural-networks/root-mean-squared-propagation`,
      },
      {
        title: "Estimasi Momen Adaptif",
        href: `${BASE_PATH}/neural-networks/adam`,
      },
      {
        title: "Overfitting dan Underfitting",
        href: `${BASE_PATH}/neural-networks/overfitting-underfitting`,
      },
      {
        title: "Regularisasi",
        href: `${BASE_PATH}/neural-networks/regularization`,
      },
      {
        title: "Penalti Parameter",
        href: `${BASE_PATH}/neural-networks/parameter-penalties`,
      },
      {
        title: "Dropout",
        href: `${BASE_PATH}/neural-networks/dropout`,
      },
      {
        title: "Pelatihan, Validasi, dan Pengujian",
        href: `${BASE_PATH}/neural-networks/train-validate-test`,
      },
      {
        title: "Praproses dan Inisialisasi",
        href: `${BASE_PATH}/neural-networks/preprocessing-initialization`,
      },
      {
        title: "Normalisasi Batch",
        href: `${BASE_PATH}/neural-networks/batch-normalization`,
      },
      {
        title: "Pencarian Hyperparameter",
        href: `${BASE_PATH}/neural-networks/hyperparameter-search`,
      },
      {
        title: "Konvolusi untuk Data Waktu",
        href: `${BASE_PATH}/neural-networks/convolution-time-series`,
      },
      {
        title: "Pooling untuk Data Waktu",
        href: `${BASE_PATH}/neural-networks/pooling-time-series`,
      },
      {
        title: "Convolutional Neural Networks untuk Data Waktu",
        href: `${BASE_PATH}/neural-networks/cnn-time-series`,
      },
      {
        title: "Konvolusi untuk Gambar",
        href: `${BASE_PATH}/neural-networks/convolution-image`,
      },
      {
        title: "Konvolusi pada Volume",
        href: `${BASE_PATH}/neural-networks/convolution-volume`,
      },
      {
        title: "Blok Konvolusi",
        href: `${BASE_PATH}/neural-networks/convolution-block`,
      },
      {
        title: "Convolutional Neural Network",
        href: `${BASE_PATH}/neural-networks/cnn`,
      },
    ],
  },
  {
    title: "Machine Learning",
    description:
      "Algoritma yang belajar dari pengalaman untuk memprediksi hasil masa depan secara otomatis.",
    href: `${BASE_PATH}/machine-learning`,
    items: [
      {
        title: "Apa itu Machine Learning?",
        href: `${BASE_PATH}/machine-learning/what-machine-learning`,
      },
      {
        title: "Apa itu Supervised Learning?",
        href: `${BASE_PATH}/machine-learning/what-supervised-learning`,
      },
      {
        title: "Pengaturan Formal untuk Supervised Learning",
        href: `${BASE_PATH}/machine-learning/formal-supervised-learning`,
      },
      {
        title: "Minimalisasi Risiko Empiris",
        href: `${BASE_PATH}/machine-learning/empirical-risk-minimization`,
      },
      {
        title: "Minimalisasi Risiko yang Teratur",
        href: `${BASE_PATH}/machine-learning/regularized-risk-minimization`,
      },
      {
        title: "K-Nearest Neighbor Classifier",
        href: `${BASE_PATH}/machine-learning/k-nearest-neighbor-classifier`,
      },
      {
        title: "Aturan Maksimum Posteriori",
        href: `${BASE_PATH}/machine-learning/maximum-posteriori-rule`,
      },
      {
        title: "Aturan Keputusan Bayesian",
        href: `${BASE_PATH}/machine-learning/bayesian-decision-rule`,
      },
      {
        title: "Fungsi Diskriminatif",
        href: `${BASE_PATH}/machine-learning/discriminant-function`,
      },
      {
        title: "Bukti Pengklasifikasi Optimal Bayes",
        href: `${BASE_PATH}/machine-learning/bayes-optimal-classifier-proof`,
      },
      {
        title: "Distribusi Normal Univariat",
        href: `${BASE_PATH}/machine-learning/univariate-normal-distribution`,
      },
      {
        title: "Probabilitas vs Kemungkinan",
        href: `${BASE_PATH}/machine-learning/probability-vs-likelihood`,
      },
      {
        title: "Estimasi Kemungkinan Maksimum",
        href: `${BASE_PATH}/machine-learning/maximum-likelihood-estimation`,
      },
      {
        title: "Contoh Estimasi Kemungkinan Maksimum",
        href: `${BASE_PATH}/machine-learning/maximum-likelihood-estimation-example`,
      },
      {
        title: "Metode Kemungkinan Maksimum",
        href: `${BASE_PATH}/machine-learning/maximum-likelihood-method`,
      },
      {
        title: "Pemasangan Parameter untuk Distribusi Normal",
        href: `${BASE_PATH}/machine-learning/parameter-fitting-normal-distribution`,
      },
      {
        title: "Kovarians",
        href: `${BASE_PATH}/machine-learning/covariance`,
      },
      {
        title: "Eigendekomposisi dari Matriks Kovarians",
        href: `${BASE_PATH}/machine-learning/eigendecomposition-covariance-matrix`,
      },
      {
        title: "Model Gaussian",
        href: `${BASE_PATH}/machine-learning/gaussian-model`,
      },
      {
        title: "Fungsi Diskriminan untuk Model Gaussian",
        href: `${BASE_PATH}/machine-learning/discriminant-function-gaussian-model`,
      },
      {
        title: "Jarak Mahalanobis",
        href: `${BASE_PATH}/machine-learning/mahalanobis-distance`,
      },
      {
        title: "Estimasi Titik",
        href: `${BASE_PATH}/machine-learning/point-estimation`,
      },
      {
        title: "Penaksir yang Tidak Bias",
        href: `${BASE_PATH}/machine-learning/unbiased-estimator`,
      },
      {
        title: "Konsistensi",
        href: `${BASE_PATH}/machine-learning/consistency`,
      },
      {
        title: "Kesalahan Kuadrat Rata-Rata",
        href: `${BASE_PATH}/machine-learning/mean-squared-error`,
      },
      {
        title: "Dekomposisi Bias-Varians dari Kesalahan Kuadrat Rata-Rata",
        href: `${BASE_PATH}/machine-learning/bias-variance-decomposition-mse`,
      },
      {
        title: "Pemilihan Model untuk Estimasi Kemungkinan Maksimum",
        href: `${BASE_PATH}/machine-learning/model-selection-mle`,
      },
      {
        title: "Divergensi Kullback-Leibler",
        href: `${BASE_PATH}/machine-learning/kl-divergence`,
      },
      {
        title: "Kriteria Informasi Akaike",
        href: `${BASE_PATH}/machine-learning/akaike-information-criterion`,
      },
      {
        title: "Validasi Silang",
        href: `${BASE_PATH}/machine-learning/cross-validation`,
      },
      {
        title: "Model Campuran Gaussian",
        href: `${BASE_PATH}/machine-learning/gaussian-mixture-model`,
      },
      {
        title: "Algoritma Maksimisasi Ekspektasi",
        href: `${BASE_PATH}/machine-learning/expectation-maximization-algorithm`,
      },
    ],
  },
  {
    title: "Optimisasi Nonlinear untuk AI",
    description:
      "Matematika lanjutan yang menemukan solusi optimal dalam ruang masalah AI yang kompleks.",
    href: `${BASE_PATH}/nonlinear-optimization`,
    items: [
      {
        title: "Masalah Optimisasi Nonlinear",
        href: `${BASE_PATH}/nonlinear-optimization/nonlinear-optimization-problem`,
      },
      {
        title: "Penerimaan dan Pengoptimalan",
        href: `${BASE_PATH}/nonlinear-optimization/acceptance-optimization`,
      },
      {
        title: "Konvergensi Proses Berulang",
        href: `${BASE_PATH}/nonlinear-optimization/convergence-repeated-process`,
      },
      {
        title: "Kondisi Optimalitas di Satu Dimensi",
        href: `${BASE_PATH}/nonlinear-optimization/one-dimensional-optimality-condition`,
      },
      {
        title: "Kondisi Optimalitas di Dua Dimensi",
        href: `${BASE_PATH}/nonlinear-optimization/two-dimensional-optimality-condition`,
      },
      {
        title: "Prosedur Degradasi",
        href: `${BASE_PATH}/nonlinear-optimization/degradation-procedure`,
      },
      {
        title: "Metode Gradien",
        href: `${BASE_PATH}/nonlinear-optimization/gradient-method`,
      },
      {
        title: "Perilaku Konvergensi",
        href: `${BASE_PATH}/nonlinear-optimization/convergence-behavior`,
      },
      {
        title: "Gradien Konjugasi",
        href: `${BASE_PATH}/nonlinear-optimization/conjugate-gradient`,
      },
      {
        title: "Metode Gradien vs Metode Gradien Konjugasi",
        href: `${BASE_PATH}/nonlinear-optimization/gradient-vs-conjugate-gradient`,
      },
      {
        title: "Metode Newton dan Metode Quasi-Newton",
        href: `${BASE_PATH}/nonlinear-optimization/newton-quasi-newton`,
      },
      {
        title: "Metode Pemrograman Kuadratik Berurutan",
        href: `${BASE_PATH}/nonlinear-optimization/sqp`,
      },
      {
        title: "Metode Quasi-Newton Pemrograman Kuadratik Berurutan",
        href: `${BASE_PATH}/nonlinear-optimization/quasi-newton-sqp`,
      },
      {
        title: "Masalah Penyetaraan Nonlinear",
        href: `${BASE_PATH}/nonlinear-optimization/nonlinear-equality-problem`,
      },
      {
        title: "Metode Gauss-Newton",
        href: `${BASE_PATH}/nonlinear-optimization/gauss-newton`,
      },
      {
        title: "Konvergensi Lokal Metode Gauss-Newton",
        href: `${BASE_PATH}/nonlinear-optimization/local-convergence-gauss-newton`,
      },
      {
        title:
          "Mengapa Pemrograman Kuadratik Berurutan Tidak Cocok untuk Regresi Nonlinier?",
        href: `${BASE_PATH}/nonlinear-optimization/why-sqp-nonlinear-regression`,
      },
      {
        title: "Masalah yang Belum Ditentukan dan Regularisasi",
        href: `${BASE_PATH}/nonlinear-optimization/underdetermined-problem-regularization`,
      },
    ],
  },
  {
    title: "Advanced Machine Learning",
    description:
      "Teknik mutakhir yang mendorong batas kemampuan kecerdasan buatan.",
    href: `${BASE_PATH}/advanced-machine-learning`,
    items: [
      {
        title: "Konsistensi Universal",
        href: `${BASE_PATH}/advanced-machine-learning/universal-consistency`,
      },
      {
        title: "Union Bound",
        href: `${BASE_PATH}/advanced-machine-learning/union-bound`,
      },
      {
        title: "Ketidaksetaraan Jensen",
        href: `${BASE_PATH}/advanced-machine-learning/jensen-inequality`,
      },
      {
        title: "Ketidaksetaraan Markov",
        href: `${BASE_PATH}/advanced-machine-learning/markov-inequality`,
      },
      {
        title: "Ketidaksetaraan Chebyshev",
        href: `${BASE_PATH}/advanced-machine-learning/chebyshev-inequality`,
      },
      {
        title: "Ketidaksetaraan Chernoff",
        href: `${BASE_PATH}/advanced-machine-learning/chernoff-inequality`,
      },
      {
        title: "Ketidaksetaraan Hoeffding",
        href: `${BASE_PATH}/advanced-machine-learning/hoeffding-inequality`,
      },
      {
        title: "Estimasi Titik",
        href: `${BASE_PATH}/advanced-machine-learning/point-estimation`,
      },
      {
        title: "Minimalisasi Risiko Empiris",
        href: `${BASE_PATH}/advanced-machine-learning/erm`,
      },
      {
        title: "Ketika Minimalisasi Risiko Empiris Gagal",
        href: `${BASE_PATH}/advanced-machine-learning/when-erm-fails`,
      },
      {
        title: "Generalization Bound",
        href: `${BASE_PATH}/advanced-machine-learning/generalization-bound`,
      },
      {
        title: "Estimasi Error Bound",
        href: `${BASE_PATH}/advanced-machine-learning/estimation-error-bound`,
      },
      {
        title: "Fungsi Pertumbuhan",
        href: `${BASE_PATH}/advanced-machine-learning/growth-function`,
      },
      {
        title: "Ketidaksetaraan Vapnik-Chervonenkis",
        href: `${BASE_PATH}/advanced-machine-learning/vc-inequality`,
      },
      {
        title: "Dimensi Vapnik-Chervonenkis",
        href: `${BASE_PATH}/advanced-machine-learning/vc-dimension`,
      },
      {
        title: "Sauer-Shelah Lemma",
        href: `${BASE_PATH}/advanced-machine-learning/sauer-shelah-lemma`,
      },
      {
        title: "Vapnik-Chervonenkis Bound",
        href: `${BASE_PATH}/advanced-machine-learning/vc-bound`,
      },
      {
        title: "Vapnik-Chervonenkis Generalization Bound",
        href: `${BASE_PATH}/advanced-machine-learning/vc-generalization-bound`,
      },
      {
        title: "Symmetrization Lemma",
        href: `${BASE_PATH}/advanced-machine-learning/symmetrization-lemma`,
      },
      {
        title: "Teorema Condorcet",
        href: `${BASE_PATH}/advanced-machine-learning/condorcet-theorem`,
      },
      {
        title: "Hard dan Soft Voting",
        href: `${BASE_PATH}/advanced-machine-learning/hard-soft-voting`,
      },
      {
        title: "Weak dan Strong Learner",
        href: `${BASE_PATH}/advanced-machine-learning/weak-strong-learner`,
      },
      {
        title: "Algoritma Boosting",
        href: `${BASE_PATH}/advanced-machine-learning/boosting-algorithm`,
      },
      {
        title: "Algoritma AdaBoost",
        href: `${BASE_PATH}/advanced-machine-learning/adaboost-algorithm`,
      },
      {
        title: "Model Aditif",
        href: `${BASE_PATH}/advanced-machine-learning/additive-model`,
      },
      {
        title: "Forward Stagewise Additive Modelling",
        href: `${BASE_PATH}/advanced-machine-learning/fsam`,
      },
      {
        title: "Analisis Teoritis",
        href: `${BASE_PATH}/advanced-machine-learning/theoretical-analysis`,
      },
    ],
  },
  {
    title: "Computer Vision",
    description:
      "Mengajarkan mesin untuk melihat dan memahami dunia visual seperti manusia.",
    href: `${BASE_PATH}/computer-vision`,
    items: [],
  },
  {
    title: "Natural Language Processing",
    description:
      "Menjembatani bahasa manusia dan pemahaman mesin untuk komunikasi yang mulus.",
    href: `${BASE_PATH}/nlp`,
    items: [],
  },
] as const;

export default idMaterials;
