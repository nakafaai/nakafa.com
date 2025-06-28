import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Struktur Atom dan Sistem Periodik Unsur",
    description:
      "Peta rahasia alam semesta yang mengungkap bagaimana unsur-unsur menyusun dunia kita.",
    href: `${BASE_PATH}/atomic-structure-periodic-table`,
    items: [
      {
        title: "Struktur Atom",
        href: `${BASE_PATH}/atomic-structure-periodic-table/structure-atom`,
      },
      {
        title: "Teori Atom Mekanika Kuantum",
        href: `${BASE_PATH}/atomic-structure-periodic-table/quantum-mechanics-theory`,
      },
      {
        title: "Sistem Periodik Unsur",
        href: `${BASE_PATH}/atomic-structure-periodic-table/periodic-table`,
      },
      {
        title: "Sifat Periodik Unsur",
        href: `${BASE_PATH}/atomic-structure-periodic-table/periodic-properties`,
      },
    ],
  },
  {
    title: "Ikatan Kimia",
    description:
      "Kekuatan tersembunyi yang menyatukan atom menciptakan segalanya dari air hingga berlian.",
    href: `${BASE_PATH}/chemical-bonding`,
    items: [
      {
        title: "Dasar Ikatan Kimia",
        href: `${BASE_PATH}/chemical-bonding/basic-chemical-bonding`,
      },
      {
        title: "Ikatan Ion",
        href: `${BASE_PATH}/chemical-bonding/ionic-bonding`,
      },
      {
        title: "Ikatan Kovalen",
        href: `${BASE_PATH}/chemical-bonding/covalent-bonding`,
      },
      {
        title: "Ikatan Logam",
        href: `${BASE_PATH}/chemical-bonding/metallic-bonding`,
      },
      {
        title: "Bentuk Molekul",
        href: `${BASE_PATH}/chemical-bonding/molecular-shape`,
      },
      {
        title: "Ikatan Antar Molekul",
        href: `${BASE_PATH}/chemical-bonding/intermolecular-bonding`,
      },
    ],
  },
  {
    title: "Stoikiometri",
    description:
      "Matematika kimia yang memungkinkan prediksi akurat dalam pembuatan obat dan makanan.",
    href: `${BASE_PATH}/stoichiometry`,
    items: [
      {
        title: "Pengertian Stoikiometri",
        href: `${BASE_PATH}/stoichiometry/definition`,
      },
      {
        title: "Konsep Mol",
        href: `${BASE_PATH}/stoichiometry/mol-concept`,
      },
      {
        title: "Rumus Molekul dan Rumus Empiris",
        href: `${BASE_PATH}/stoichiometry/molecular-empirical-formula`,
      },
      {
        title: "Pereaksi Pembatas",
        href: `${BASE_PATH}/stoichiometry/limiting-reagent`,
      },
      {
        title: "Persen Hasil",
        href: `${BASE_PATH}/stoichiometry/percentage-yield`,
      },
      {
        title: "Persen Kemurnian",
        href: `${BASE_PATH}/stoichiometry/percentage-purity`,
      },
    ],
  },
  {
    title: "Hidrokarbon",
    description:
      "Sumber energi vital dari plastik hingga bahan bakar yang menggerakkan peradaban modern.",
    href: `${BASE_PATH}/hydrocarbon`,
    items: [
      {
        title: "Kekhasan Atom Karbon",
        href: `${BASE_PATH}/hydrocarbon/carbon-atom-characteristics`,
      },
      {
        title: "Klasifikasi Hidrokarbon",
        href: `${BASE_PATH}/hydrocarbon/classification`,
      },
      {
        title: "Alkana",
        href: `${BASE_PATH}/hydrocarbon/alkane`,
      },
      {
        title: "Alkena dan Alkuna",
        href: `${BASE_PATH}/hydrocarbon/alkene-alkyne`,
      },
      {
        title: "Hidrokarbon Aromatik",
        href: `${BASE_PATH}/hydrocarbon/aromatic-hydrocarbon`,
      },
      {
        title: "Sifat Fisis dan Kimia Hidrokarbon",
        href: `${BASE_PATH}/hydrocarbon/physical-chemical-properties`,
      },
      {
        title: "Isomer pada Hidrokarbon",
        href: `${BASE_PATH}/hydrocarbon/isomer`,
      },
      {
        title: "Dampak Pembakaran Hidrokarbon",
        href: `${BASE_PATH}/hydrocarbon/combustion-impacts`,
      },
    ],
  },
  {
    title: "Termokimia",
    description:
      "Studi energi dalam reaksi kimia yang menjelaskan mengapa kayu terbakar dan es mencair.",
    href: `${BASE_PATH}/thermochemistry`,
    items: [
      {
        title: "Hukum Kekekalan Energi",
        href: `${BASE_PATH}/thermochemistry/law-conservation-energy`,
      },
      {
        title: "Sistem dan Lingkungan",
        href: `${BASE_PATH}/thermochemistry/system-environment`,
      },
      {
        title: "Reaksi Eksotermik dan Endotermik",
        href: `${BASE_PATH}/thermochemistry/exothermic-endothermic-reactions`,
      },
      {
        title: "Kalorimetri",
        href: `${BASE_PATH}/thermochemistry/calorimetry`,
      },
      {
        title: "Entalpi dan Perubahan Entalpi",
        href: `${BASE_PATH}/thermochemistry/enthalpy-enthalpy-change`,
      },
      {
        title: "Persamaan Termokimia",
        href: `${BASE_PATH}/thermochemistry/thermochemical-equation`,
      },
      {
        title: "Perubahan Entalpi dalam Keadaan Standar",
        href: `${BASE_PATH}/thermochemistry/enthalpy-standard-state`,
      },
      {
        title: "Hukum Hess",
        href: `${BASE_PATH}/thermochemistry/hess-law`,
      },
      {
        title: "Energi Ikatan",
        href: `${BASE_PATH}/thermochemistry/bond-energy`,
      },
    ],
  },
  {
    title: "Kinetika Kimia",
    description:
      "Mengungkap kecepatan reaksi untuk mengoptimalkan produksi industri dan obat-obatan.",
    href: `${BASE_PATH}/kinetic-chemistry`,
    items: [
      {
        title: "Teori Tumbukan",
        href: `${BASE_PATH}/kinetic-chemistry/collision-theory`,
      },
      {
        title: "Laju Reaksi",
        href: `${BASE_PATH}/kinetic-chemistry/reaction-rate`,
      },
      {
        title: "Persamaan Laju Reaksi dan Orde Reaksi",
        href: `${BASE_PATH}/kinetic-chemistry/reaction-rate-equation-order`,
      },
      {
        title: "Faktor-Faktor yang Mempengaruhi Laju Reaksi",
        href: `${BASE_PATH}/kinetic-chemistry/factors-affecting-reaction-rate`,
      },
    ],
  },
  {
    title: "Kesetimbangan Kimia",
    description:
      "Harmoni dinamis dalam reaksi yang memungkinkan kontrol presisi dalam sintesis kimia.",
    href: `${BASE_PATH}/chemical-equilibrium`,
    items: [
      {
        title: "Konsep Kesetimbangan Kimia",
        href: `${BASE_PATH}/chemical-equilibrium/concept`,
      },
      {
        title: "Tetapan Kesetimbangan",
        href: `${BASE_PATH}/chemical-equilibrium/equilibrium-constant`,
      },
      {
        title: "Menggunakan Tetapan Kesetimbangan dalam Perhitungan",
        href: `${BASE_PATH}/chemical-equilibrium/equilibrium-constant-calculations`,
      },
      {
        title: "Pergeseran Kesetimbangan",
        href: `${BASE_PATH}/chemical-equilibrium/equilibrium-shift`,
      },
      {
        title: "Kesetimbangan Kimia dalam Industri",
        href: `${BASE_PATH}/chemical-equilibrium/industrial-applications`,
      },
    ],
  },
] as const;

export default idMaterials;
