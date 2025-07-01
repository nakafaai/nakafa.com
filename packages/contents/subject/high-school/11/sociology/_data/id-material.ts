import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Kelompok Sosial",
    description:
      "Jaringan manusia yang membentuk identitas dan menentukan tempat kita di dunia.",
    href: `${BASE_PATH}/social-groups`,
    items: [
      {
        title: "Kelompok dan Pengelompokan Sosial",
        href: `${BASE_PATH}/social-groups/classification`,
      },
      {
        title: "Ragam Kelompok Sosial",
        href: `${BASE_PATH}/social-groups/variety`,
      },
      {
        title: "Dinamika Kelompok Sosial",
        href: `${BASE_PATH}/social-groups/dynamics`,
      },
    ],
  },
  {
    title: "Permasalahan Sosial Akibat Pengelompokan Sosial",
    description:
      "Tantangan kompleks yang muncul ketika perbedaan kelompok menciptakan ketegangan.",
    href: `${BASE_PATH}/social-problems`,
    items: [
      {
        title: "Permasalahan Sosial Terkait Pengelompokan Sosial",
        href: `${BASE_PATH}/social-problems/classification`,
      },
      {
        title: "Ragam Permasalahan Sosial Terkait Pengelompokan Sosial",
        href: `${BASE_PATH}/social-problems/variety`,
      },
      {
        title: "Penelitian Berbasis Pemecahan Masalah Sosial",
        href: `${BASE_PATH}/social-problems/research-based-problem-solving`,
      },
    ],
  },
  {
    title: "Konflik Sosial",
    description:
      "Benturan kepentingan yang dapat menghancurkan atau memperkuat ikatan masyarakat.",
    href: `${BASE_PATH}/social-conflicts`,
    items: [
      {
        title: "Konsep Konflik Sosial",
        href: `${BASE_PATH}/social-conflicts/concept`,
      },
      {
        title: "Penanganan Konflik untuk Menciptakan Perdamaian",
        href: `${BASE_PATH}/social-conflicts/conflict-resolution`,
      },
      {
        title: "Penelitian Berbasis Pemecahan Konflik",
        href: `${BASE_PATH}/social-conflicts/research-based-conflict-resolution`,
      },
    ],
  },
  {
    title: "Membangun Harmoni Sosial",
    description:
      "Seni menciptakan keseimbangan indah dalam keragaman masyarakat yang kompleks.",
    href: `${BASE_PATH}/social-harmony`,
    items: [
      {
        title: "Prinsip dalam Membangun Harmoni Sosial",
        href: `${BASE_PATH}/social-harmony/principles`,
      },
      {
        title: "Upaya untuk Membangun Harmoni Sosial",
        href: `${BASE_PATH}/social-harmony/efforts`,
      },
      {
        title: "Merancang Aksi untuk Mambangun Harmoni Sosial",
        href: `${BASE_PATH}/social-harmony/action-planning`,
      },
    ],
  },
] as const;

export default idMaterials;
