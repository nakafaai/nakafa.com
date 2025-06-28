import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Listrik Statis",
    description:
      "Kekuatan tak terlihat yang membuat rambut berdiri dan memungkinkan teknologi touchscreen bekerja.",
    href: `${BASE_PATH}/static-electricity`,
    items: [
      {
        title: "Gaya Listrik",
        href: `${BASE_PATH}/static-electricity/electric-force`,
      },
      {
        title: "Hukum Coulomb",
        href: `${BASE_PATH}/static-electricity/coulomb-law`,
      },
      {
        title: "Resultan Gaya",
        href: `${BASE_PATH}/static-electricity/resultant-force`,
      },
      {
        title: "Medan Listrik Muatan Titik",
        href: `${BASE_PATH}/static-electricity/point-charge-electric-field`,
      },
      {
        title: "Medan Listrik pada Pelat Paralel",
        href: `${BASE_PATH}/static-electricity/parallel-plate-electric-field`,
      },
      {
        title: "Kapasitor Keping Sejajar",
        href: `${BASE_PATH}/static-electricity/parallel-plate-capacitor`,
      },
      {
        title: "Rangkaian Kapasitor",
        href: `${BASE_PATH}/static-electricity/capacitor-circuit`,
      },
      {
        title: "Rangkaian Seri",
        href: `${BASE_PATH}/static-electricity/series-circuit`,
      },
      {
        title: "Rangkaian Paralel",
        href: `${BASE_PATH}/static-electricity/parallel-circuit`,
      },
    ],
  },
  {
    title: "Listrik Arus Searah",
    description:
      "Dasar semua perangkat elektronik dari smartphone hingga mobil listrik yang mengubah dunia.",
    href: `${BASE_PATH}/direct-current`,
    items: [
      {
        title: "Arus Listrik",
        href: `${BASE_PATH}/direct-current/electric-current`,
      },
      {
        title: "Hambatan Ohmik dan Non Ohmik",
        href: `${BASE_PATH}/static-electricity/ohmic-non-ohmic-resistance`,
      },
      {
        title: "Hambatan Jenis",
        href: `${BASE_PATH}/static-electricity/resistivity`,
      },
      {
        title: "Rangkaian Listrik",
        href: `${BASE_PATH}/static-electricity/electric-circuit`,
      },
      {
        title: "Rangkaian Majemuk",
        href: `${BASE_PATH}/static-electricity/compound-circuit`,
      },
      {
        title: "Daya Listrik",
        href: `${BASE_PATH}/static-electricity/electric-power`,
      },
    ],
  },
  {
    title: "Kemagnetan",
    description:
      "Gaya misterius yang memandu kompas dan menggerakkan motor listrik dalam kehidupan modern.",
    href: `${BASE_PATH}/magnetism`,
    items: [
      {
        title: "Medan Magnet",
        href: `${BASE_PATH}/static-electricity/magnetic-field`,
      },
      {
        title: "Gaya pada Muatan Bergerak",
        href: `${BASE_PATH}/static-electricity/force-moving-charge`,
      },
      {
        title: "Gaya Magnet pada Kawat Berarus Listrik",
        href: `${BASE_PATH}/static-electricity/force-current-carrying-conductor`,
      },
      {
        title: "Motor Listrik",
        href: `${BASE_PATH}/static-electricity/electric-motor`,
      },
      {
        title: "Medan Magnet Induksi",
        href: `${BASE_PATH}/static-electricity/magnetic-induction`,
      },
      {
        title: "Medan Magnet di Sekitar Kawat Lurus",
        href: `${BASE_PATH}/static-electricity/magnetic-field-straight-wire`,
      },
      {
        title: "Kawat Melingkar Berarus Listrik",
        href: `${BASE_PATH}/static-electricity/current-carrying-circular-wire`,
      },
      {
        title: "Solenoida",
        href: `${BASE_PATH}/static-electricity/solenoid`,
      },
      {
        title: "Gaya Gerak Listrik Induksi",
        href: `${BASE_PATH}/static-electricity/induced-emf`,
      },
      {
        title: "Fluks Magnet",
        href: `${BASE_PATH}/static-electricity/magnetic-flux`,
      },
      {
        title: "Besar Gaya Gerak Listrik Induksi",
        href: `${BASE_PATH}/static-electricity/induced-emf-magnitude`,
      },
      {
        title: "Generator",
        href: `${BASE_PATH}/static-electricity/generator`,
      },
      {
        title: "Induktansi",
        href: `${BASE_PATH}/static-electricity/inductance`,
      },
      {
        title: "Transformator",
        href: `${BASE_PATH}/static-electricity/transformer`,
      },
    ],
  },
  {
    title: "Arus Bolak-balik",
    description:
      "Teknologi revolusioner yang membawa listrik ke rumah-rumah di seluruh dunia.",
    href: `${BASE_PATH}/alternating-current`,
    items: [
      {
        title: "Persamaan Arus Bolak Balik",
        href: `${BASE_PATH}/alternating-current/alternating-current-equation`,
      },
      {
        title: "Resistor",
        href: `${BASE_PATH}/alternating-current/resistor`,
      },
      {
        title: "Induktor",
        href: `${BASE_PATH}/alternating-current/inductor`,
      },
      {
        title: "Kapasitor",
        href: `${BASE_PATH}/alternating-current/capacitor`,
      },
      {
        title: "Rangkaian R-L-C",
        href: `${BASE_PATH}/alternating-current/rlc-circuit`,
      },
      {
        title: "Resonansi Rangkaian",
        href: `${BASE_PATH}/alternating-current/resonance-circuit`,
      },
    ],
  },
  {
    title: "Gelombang Elektromagnetik",
    description:
      "Spektrum tak terlihat yang memungkinkan WiFi, radio, dan sinar-X mengubah peradaban.",
    href: `${BASE_PATH}/electromagnetic-wave`,
    items: [
      {
        title: "Perambatan Gelombang Elektromagnetik",
        href: `${BASE_PATH}/electromagnetic-wave/propagation`,
      },
      {
        title: "Spektrum Gelombang Elektromagnetik",
        href: `${BASE_PATH}/electromagnetic-wave/spectrum`,
      },
      {
        title: "Energi Gelombang Elektromagnetik",
        href: `${BASE_PATH}/electromagnetic-wave/energy`,
      },
      {
        title: "Sinar Gamma dan Sinar X",
        href: `${BASE_PATH}/electromagnetic-wave/gamma-x-ray`,
      },
      {
        title: "Sinar Ultraviolet",
        href: `${BASE_PATH}/electromagnetic-wave/ultraviolet-ray`,
      },
      {
        title: "Cahaya Tampak",
        href: `${BASE_PATH}/electromagnetic-wave/visible-light`,
      },
      {
        title: "Inframerah",
        href: `${BASE_PATH}/electromagnetic-wave/infrared-ray`,
      },
      {
        title: "Gelombang Mikro",
        href: `${BASE_PATH}/electromagnetic-wave/microwave`,
      },
      {
        title: "Gelombang Radio",
        href: `${BASE_PATH}/electromagnetic-wave/radio-wave`,
      },
    ],
  },
  {
    title: "Pengantar Sistem Elektronika",
    description:
      "Gerbang menuju teknologi digital yang mengubah dunia dari LED hingga komputer modern.",
    href: `${BASE_PATH}/electronic-systems`,
    items: [
      {
        title: "Sistem Elektronika",
        href: `${BASE_PATH}/electronic-systems/electronic-system`,
      },
      {
        title: "Semikonduktor",
        href: `${BASE_PATH}/electronic-systems/semiconductor`,
      },
      {
        title: "Light-Emitting Diode (LED)",
        href: `${BASE_PATH}/electronic-systems/led`,
      },
      {
        title: "Transistor",
        href: `${BASE_PATH}/electronic-systems/transistor`,
      },
      {
        title: "Sirkuit Terpadu (Integrated Circuit / IC)",
        href: `${BASE_PATH}/electronic-systems/integrated-circuit`,
      },
      {
        title: "Prinsip Gerbang Logika",
        href: `${BASE_PATH}/electronic-systems/logic-gate`,
      },
    ],
  },
  {
    title: "Relativitas",
    description:
      "Teori revolusioner Einstein yang mengungkap rahasia ruang, waktu, dan kecepatan cahaya.",
    href: `${BASE_PATH}/relativity`,
    items: [
      {
        title: "Gerak Relatif Newton",
        href: `${BASE_PATH}/relativity/newtonian-relative-motion`,
      },
      {
        title: "Relativitas Einstein",
        href: `${BASE_PATH}/relativity/einstein-relativity`,
      },
      {
        title: "Dilatasi Waktu",
        href: `${BASE_PATH}/relativity/time-dilation`,
      },
      {
        title: "Penambahan Kecepatan",
        href: `${BASE_PATH}/relativity/velocity-addition`,
      },
    ],
  },
  {
    title: "Gejala Kuantum",
    description:
      "Dunia aneh partikel yang memungkinkan laser, LED, dan komputer kuantum masa depan.",
    href: `${BASE_PATH}/quantum-phenomena`,
    items: [
      {
        title: "Konsep Foton",
        href: `${BASE_PATH}/quantum-phenomena/photon-concept`,
      },
      {
        title: "Radiasi Benda Hitam",
        href: `${BASE_PATH}/quantum-phenomena/black-body-radiation`,
      },
      {
        title: "Pergeseran Wien",
        href: `${BASE_PATH}/quantum-phenomena/wien-shift`,
      },
      {
        title: "Teori Kuantum Planck",
        href: `${BASE_PATH}/quantum-phenomena/planck-quantum-theory`,
      },
      {
        title: "Efek Fotolistrik",
        href: `${BASE_PATH}/quantum-phenomena/photoelectric-effect`,
      },
      {
        title: "Efek Compton",
        href: `${BASE_PATH}/quantum-phenomena/compton-effect`,
      },
      {
        title: "Sinar X",
        href: `${BASE_PATH}/quantum-phenomena/x-ray`,
      },
    ],
  },
  {
    title: "Fisika Inti dan Radioaktivitas",
    description:
      "Kekuatan dahsyat atom yang memberi energi bintang dan teknologi kedokteran modern.",
    href: `${BASE_PATH}/nuclear-physics`,
    items: [
      {
        title: "Penemuan Inti Atom",
        href: `${BASE_PATH}/nuclear-physics/discovery-atomic-nucleus`,
      },
      {
        title: "Sejarah Penemuan Inti Atom",
        href: `${BASE_PATH}/nuclear-physics/history-discovery-atomic-nucleus`,
      },
      {
        title: "Karakteristik Inti Atom",
        href: `${BASE_PATH}/nuclear-physics/characteristics-atomic-nucleus`,
      },
      {
        title: "Defek Massa dan Energi Ikat",
        href: `${BASE_PATH}/nuclear-physics/mass-energy-binding-energy`,
      },
      {
        title: "Radioaktivitas",
        href: `${BASE_PATH}/nuclear-physics/radioactivity`,
      },
      {
        title: "Partikel Radiasi",
        href: `${BASE_PATH}/nuclear-physics/radiation-particles`,
      },
      {
        title: "Peluruhan Alfa",
        href: `${BASE_PATH}/nuclear-physics/alpha-decay`,
      },
      {
        title: "Peluruhan Beta",
        href: `${BASE_PATH}/nuclear-physics/beta-decay`,
      },
      {
        title: "Radiasi Sinar Gamma",
        href: `${BASE_PATH}/nuclear-physics/gamma-ray`,
      },
      {
        title: "Peluruhan Beta Plus",
        href: `${BASE_PATH}/nuclear-physics/beta-plus-decay`,
      },
      {
        title: "Reaksi Inti",
        href: `${BASE_PATH}/nuclear-physics/nuclear-reaction`,
      },
      {
        title: "Reaksi Fisi",
        href: `${BASE_PATH}/nuclear-physics/fission-reaction`,
      },
      {
        title: "Reaksi Fusi",
        href: `${BASE_PATH}/nuclear-physics/fusion-reaction`,
      },
    ],
  },
] as const;

export default idMaterials;
