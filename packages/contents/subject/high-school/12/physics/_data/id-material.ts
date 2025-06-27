import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Listrik Statis",
    description:
      "Kekuatan tak terlihat yang membuat rambut berdiri dan memungkinkan teknologi touchscreen bekerja.",
    href: `${BASE_PATH}/static-electricity`,
    items: [],
  },
  {
    title: "Listrik Arus Searah",
    description:
      "Dasar semua perangkat elektronik dari smartphone hingga mobil listrik yang mengubah dunia.",
    href: `${BASE_PATH}/direct-current`,
    items: [],
  },
  {
    title: "Kemagnetan",
    description:
      "Gaya misterius yang memandu kompas dan menggerakkan motor listrik dalam kehidupan modern.",
    href: `${BASE_PATH}/magnetism`,
    items: [],
  },
  {
    title: "Arus Bolak-balik",
    description:
      "Teknologi revolusioner yang membawa listrik ke rumah-rumah di seluruh dunia.",
    href: `${BASE_PATH}/alternating-current`,
    items: [],
  },
  {
    title: "Gelombang Elektromagnetik",
    description:
      "Spektrum tak terlihat yang memungkinkan WiFi, radio, dan sinar-X mengubah peradaban.",
    href: `${BASE_PATH}/electromagnetic-wave`,
    items: [],
  },
  {
    title: "Pengantar Fisika Modern",
    description:
      "Gerbang menuju pemahaman alam semesta yang mengubah pandangan kita tentang realitas.",
    href: `${BASE_PATH}/modern-physics-intro`,
    items: [],
  },
  {
    title: "Relativitas",
    description:
      "Teori revolusioner Einstein yang mengungkap rahasia ruang, waktu, dan kecepatan cahaya.",
    href: `${BASE_PATH}/relativity`,
    items: [],
  },
  {
    title: "Gejala Kuantum",
    description:
      "Dunia aneh partikel yang memungkinkan laser, LED, dan komputer kuantum masa depan.",
    href: `${BASE_PATH}/quantum-phenomena`,
    items: [],
  },
  {
    title: "Fisika Inti dan Radioaktivitas",
    description:
      "Kekuatan dahsyat atom yang memberi energi bintang dan teknologi kedokteran modern.",
    href: `${BASE_PATH}/nuclear-physics`,
    items: [],
  },
] as const;

export default idMaterials;
