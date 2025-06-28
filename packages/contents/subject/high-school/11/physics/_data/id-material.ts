import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Vektor",
    description:
      "Bahasa matematika untuk menjelaskan arah dan besaran dalam dunia 3D, dari GPS hingga game.",
    href: `${BASE_PATH}/vector`,
    items: [
      {
        title: "Konsep Vektor",
        href: `${BASE_PATH}/vector/concept`,
      },
      {
        title: "Lambang dan Notasi Vektor",
        href: `${BASE_PATH}/vector/notation`,
      },
      {
        title: "Sifat-sifat Vektor",
        href: `${BASE_PATH}/vector/property`,
      },
      {
        title: "Komponen Vektor",
        href: `${BASE_PATH}/vector/component`,
      },
      {
        title: "Penguraian Vektor Berdasarkan Aturan Trigonometri",
        href: `${BASE_PATH}/vector/trigonometry-decomposition`,
      },
      {
        title: "Penjumlahan dan Pengurangan Vektor dengan Metode Grafis",
        href: `${BASE_PATH}/vector/graphical-addition-subtraction`,
      },
      {
        title: "Penjumlahan dan Pengurangan Vektor dengan Metode Analitis",
        href: `${BASE_PATH}/vector/analytical-addition-subtraction`,
      },
      {
        title: "Penentuan Resultan Vektor dengan Rumus Kosinus",
        href: `${BASE_PATH}/vector/cosine-rule`,
      },
      {
        title: "Penentuan Arah Resultan Vektor dengan Rumus Sinus",
        href: `${BASE_PATH}/vector/sine-rule`,
      },
      {
        title: "Perkalian Vektor",
        href: `${BASE_PATH}/vector/multiplication`,
      },
    ],
  },
  {
    title: "Kinematika",
    description:
      "Seni memprediksi gerak benda dari peluru hingga satelit tanpa mempedulikan penyebabnya.",
    href: `${BASE_PATH}/kinematics`,
    items: [
      {
        title: "Kerangka Acuan dan Posisi",
        href: `${BASE_PATH}/kinematics/reference-frame-position`,
      },
      {
        title: "Gerak Sebagai Perubahan Posisi",
        href: `${BASE_PATH}/kinematics/movement-position-change`,
      },
      {
        title: "Perpindahan dan Jarak",
        href: `${BASE_PATH}/kinematics/displacement-distance`,
      },
      {
        title: "Kecepatan dan Kelajuan",
        href: `${BASE_PATH}/kinematics/velocity-speed`,
      },
      {
        title: "Gerak Relatif",
        href: `${BASE_PATH}/kinematics/relative-movement`,
      },
      {
        title: "Kecepatan dan Kelajuan Sesaat",
        href: `${BASE_PATH}/kinematics/instantaneous-velocity-speed`,
      },
      {
        title: "Kecepatan dan Kelajuan Rata-Rata",
        href: `${BASE_PATH}/kinematics/average-velocity-speed`,
      },
      {
        title: "Percepatan",
        href: `${BASE_PATH}/kinematics/acceleration`,
      },
      {
        title: "Gerak Lurus Beraturan",
        href: `${BASE_PATH}/kinematics/uniform-linear-motion`,
      },
      {
        title: "Gerak Lurus Berubah Beraturan",
        href: `${BASE_PATH}/kinematics/non-uniform-linear-motion`,
      },
      {
        title: "Jarak Henti",
        href: `${BASE_PATH}/kinematics/stopping-distance`,
      },
      {
        title: "Gerak Vertikal",
        href: `${BASE_PATH}/kinematics/vertical-movement`,
      },
      {
        title: "Gerak Parabola",
        href: `${BASE_PATH}/kinematics/parabolic-movement`,
      },
      {
        title: "Analisis Gerak Parabola",
        href: `${BASE_PATH}/kinematics/parabolic-movement-analysis`,
      },
      {
        title: "Gerak Melingkar Beraturan",
        href: `${BASE_PATH}/kinematics/uniform-circular-motion`,
      },
    ],
  },
  {
    title: "Dinamika Gerak Partikel",
    description:
      "Rahasia di balik setiap gerakan, dari roket meluncur hingga mobil berbelok dengan aman.",
    href: `${BASE_PATH}/particle-dynamics`,
    items: [
      {
        title: "Hukum I Newton",
        href: `${BASE_PATH}/particle-dynamics/newton-first-law`,
      },
      {
        title: "Hukum II Newton",
        href: `${BASE_PATH}/particle-dynamics/newton-second-law`,
      },
      {
        title: "Hukum III Newton",
        href: `${BASE_PATH}/particle-dynamics/newton-third-law`,
      },
      {
        title: "Gaya Berat",
        href: `${BASE_PATH}/particle-dynamics/weight-force`,
      },
      {
        title: "Gaya Normal",
        href: `${BASE_PATH}/particle-dynamics/normal-force`,
      },
      {
        title: "Gaya Gesek Benda Padat",
        href: `${BASE_PATH}/particle-dynamics/solid-friction`,
      },
      {
        title: "Gaya Gesek Fluida",
        href: `${BASE_PATH}/particle-dynamics/fluid-friction`,
      },
      {
        title: "Gaya Sentripetal",
        href: `${BASE_PATH}/particle-dynamics/centripetal-force`,
      },
      {
        title: "Hukum Kekekalan Momentum",
        href: `${BASE_PATH}/particle-dynamics/momentum-conservation`,
      },
      {
        title: "Jenis-Jenis Tumbukan",
        href: `${BASE_PATH}/particle-dynamics/collision-types`,
      },
      {
        title: "Gerak Rotasi",
        href: `${BASE_PATH}/particle-dynamics/rotational-motion`,
      },
      {
        title: "Momen Gaya",
        href: `${BASE_PATH}/particle-dynamics/torque`,
      },
      {
        title: "Momen Inersia",
        href: `${BASE_PATH}/particle-dynamics/inertia-moment`,
      },
    ],
  },
  {
    title: "Fluida",
    description:
      "Ilmu yang mengungkap misteri cairan mengalir dan gas bergerak dalam kehidupan sehari-hari.",
    href: `${BASE_PATH}/fluid`,
    items: [
      {
        title: "Fluida Statis",
        href: `${BASE_PATH}/fluid/static-fluid`,
      },
      {
        title: "Tekanan Hidrostatis",
        href: `${BASE_PATH}/fluid/hydrostatic-pressure`,
      },
      {
        title: "Prinsip Archimedes",
        href: `${BASE_PATH}/fluid/archimedes-principle`,
      },
      {
        title: "Tegangan Permukaan",
        href: `${BASE_PATH}/fluid/surface-tension`,
      },
      {
        title: "Viskositas",
        href: `${BASE_PATH}/fluid/viscosity`,
      },
      {
        title: "Fluida Dinamis",
        href: `${BASE_PATH}/fluid/dynamic-fluid`,
      },
      {
        title: "Fluida Ideal",
        href: `${BASE_PATH}/fluid/ideal-fluid`,
      },
      {
        title: "Asas Kontinuitas",
        href: `${BASE_PATH}/fluid/continuity-principle`,
      },
      {
        title: "Persamaan Bernoulli",
        href: `${BASE_PATH}/fluid/bernoulli-equation`,
      },
      {
        title: "Penerapan Prinsip Bernoulli",
        href: `${BASE_PATH}/fluid/bernoulli-principle-application`,
      },
    ],
  },
  {
    title: "Gelombang, Bunyi, dan Cahaya",
    description:
      "Fenomena menakjubkan yang memungkinkan kita mendengar musik dan melihat dunia.",
    href: `${BASE_PATH}/wave-sound-light`,
    items: [
      {
        title: "Gelombang",
        href: `${BASE_PATH}/wave-sound-light/wave`,
      },
      {
        title: "Jenis-Jenis Gelombang",
        href: `${BASE_PATH}/wave-sound-light/wave-types`,
      },
      {
        title: "Prinsip-Prinsip Gelombang",
        href: `${BASE_PATH}/wave-sound-light/wave-principles`,
      },
      {
        title: "Gelombang Bunyi",
        href: `${BASE_PATH}/wave-sound-light/sound-wave`,
      },
      {
        title: "Cepat Rambat Bunyi",
        href: `${BASE_PATH}/wave-sound-light/sound-speed`,
      },
      {
        title: "Sumber Bunyi",
        href: `${BASE_PATH}/wave-sound-light/sound-source`,
      },
      {
        title: "Efek Doppler",
        href: `${BASE_PATH}/wave-sound-light/doppler-effect`,
      },
      {
        title: "Resonansi",
        href: `${BASE_PATH}/wave-sound-light/resonance`,
      },
      {
        title: "Pelayangan Bunyi",
        href: `${BASE_PATH}/wave-sound-light/beat-sound`,
      },
      {
        title: "Intensitas dan Taraf Intensitas Bunyi",
        href: `${BASE_PATH}/wave-sound-light/intensity-intensity-level`,
      },
      {
        title: "Aplikasi Gelombang Bunyi",
        href: `${BASE_PATH}/wave-sound-light/sound-wave-application`,
      },
      {
        title: "Gelombang Cahaya",
        href: `${BASE_PATH}/wave-sound-light/light-wave`,
      },
      {
        title: "Interferensi Cahaya",
        href: `${BASE_PATH}/wave-sound-light/interference-light`,
      },
      {
        title: "Difraksi Cahaya",
        href: `${BASE_PATH}/wave-sound-light/diffraction-light`,
      },
      {
        title: "Polarisasi",
        href: `${BASE_PATH}/wave-sound-light/polarization`,
      },
      {
        title: "Aplikasi Gelombang Cahaya",
        href: `${BASE_PATH}/wave-sound-light/light-wave-application`,
      },
    ],
  },
  {
    title: "Kalor",
    description:
      "Energi tersembunyi yang menggerakkan mesin dan menghangatkan rumah kita.",
    href: `${BASE_PATH}/heat`,
    items: [
      {
        title: "Pengertian Suhu dan Alat Ukurnya",
        href: `${BASE_PATH}/heat/temperature-measurement`,
      },
      {
        title: "Skala Suhu",
        href: `${BASE_PATH}/heat/temperature-scale`,
      },
      {
        title: "Pengertian Kalor",
        href: `${BASE_PATH}/heat/heat-definition`,
      },
      {
        title: "Pengaruh Kalor pada Perubahan Suhu",
        href: `${BASE_PATH}/heat/heat-effect-temperature-change`,
      },
      {
        title: "Pengaruh Kalor pada Perubahan Wujud",
        href: `${BASE_PATH}/heat/heat-effect-phase-change`,
      },
      {
        title: "Pengaruh Kalor pada Pemuaian",
        href: `${BASE_PATH}/heat/heat-effect-expansion`,
      },
      {
        title: "Konduksi",
        href: `${BASE_PATH}/heat/conduction`,
      },
      {
        title: "Konveksi",
        href: `${BASE_PATH}/heat/convection`,
      },
      {
        title: "Radiasi",
        href: `${BASE_PATH}/heat/radiation`,
      },
      {
        title: "Aplikasi Perpindahan Kalor",
        href: `${BASE_PATH}/heat/heat-transfer-application`,
      },
    ],
  },
  {
    title: "Termodinamika",
    description:
      "Hukum fundamental alam semesta yang mengatur efisiensi mesin dan kehidupan itu sendiri.",
    href: `${BASE_PATH}/thermodynamics`,
    items: [
      {
        title: "Pengertian Gas",
        href: `${BASE_PATH}/thermodynamics/gas-definition`,
      },
      {
        title: "Hukum-Hukum tentang Gas",
        href: `${BASE_PATH}/thermodynamics/gas-laws`,
      },
      {
        title: "Gas Nyata dan Hukum Gas Ideal",
        href: `${BASE_PATH}/thermodynamics/real-ideal-gas`,
      },
      {
        title: "Sistem dan Lingkungan",
        href: `${BASE_PATH}/thermodynamics/system-environment`,
      },
      {
        title: "Sifat-Sifat Sistem Termodinamika",
        href: `${BASE_PATH}/thermodynamics/system-properties`,
      },
      {
        title: "Diagram p-V",
        href: `${BASE_PATH}/thermodynamics/p-v-diagram`,
      },
      {
        title: "Usaha dan Gas Ideal",
        href: `${BASE_PATH}/thermodynamics/work-ideal-gas`,
      },
      {
        title: "Empat Proses Termodinamika",
        href: `${BASE_PATH}/thermodynamics/four-thermodynamic-processes`,
      },
      {
        title: "Proses Reversibel dan Ireversibel",
        href: `${BASE_PATH}/thermodynamics/reversible-irreversible-process`,
      },
      {
        title: "Hukum ke Nol Termodinamika",
        href: `${BASE_PATH}/thermodynamics/zeroth-law-thermodynamics`,
      },
      {
        title: "Hukum I Termodinamika",
        href: `${BASE_PATH}/thermodynamics/first-law-thermodynamics`,
      },
      {
        title: "Aplikasi Hukum I Termodinamika dalam Proses Termodinamika",
        href: `${BASE_PATH}/thermodynamics/first-law-thermodynamics-application`,
      },
      {
        title: "Kapasitas Panas",
        href: `${BASE_PATH}/thermodynamics/heat-capacity`,
      },
      {
        title: "Hukum II Termodinamika",
        href: `${BASE_PATH}/thermodynamics/second-law-thermodynamics`,
      },
      {
        title: "Mesin Kalor",
        href: `${BASE_PATH}/thermodynamics/heat-engine`,
      },
      {
        title: "Pompa Kalor",
        href: `${BASE_PATH}/thermodynamics/heat-pump`,
      },
    ],
  },
] as const;

export default idMaterials;
