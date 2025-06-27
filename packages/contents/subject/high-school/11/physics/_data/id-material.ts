import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Vektor",
    description:
      "Bahasa matematika untuk menjelaskan arah dan besaran dalam dunia 3D, dari GPS hingga game.",
    href: `${BASE_PATH}/vector`,
    items: [],
  },
  {
    title: "Kinematika",
    description:
      "Seni memprediksi gerak benda dari peluru hingga satelit tanpa mempedulikan penyebabnya.",
    href: `${BASE_PATH}/kinematics`,
    items: [],
  },
  {
    title: "Dinamika Gerak Partikel",
    description:
      "Rahasia di balik setiap gerakan, dari roket meluncur hingga mobil berbelok dengan aman.",
    href: `${BASE_PATH}/particle-dynamics`,
    items: [],
  },
  {
    title: "Fluida",
    description:
      "Ilmu yang mengungkap misteri cairan mengalir dan gas bergerak dalam kehidupan sehari-hari.",
    href: `${BASE_PATH}/fluid`,
    items: [],
  },
  {
    title: "Gelombang, Bunyi, dan Cahaya",
    description:
      "Fenomena menakjubkan yang memungkinkan kita mendengar musik dan melihat dunia.",
    href: `${BASE_PATH}/wave-sound-light`,
    items: [],
  },
  {
    title: "Kalor",
    description:
      "Energi tersembunyi yang menggerakkan mesin dan menghangatkan rumah kita.",
    href: `${BASE_PATH}/heat`,
    items: [],
  },
  {
    title: "Termodinamika",
    description:
      "Hukum fundamental alam semesta yang mengatur efisiensi mesin dan kehidupan itu sendiri.",
    href: `${BASE_PATH}/thermodynamics`,
    items: [],
  },
] as const;

export default idMaterials;
