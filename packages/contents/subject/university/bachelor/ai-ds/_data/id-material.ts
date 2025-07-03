import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Metode Linear AI",
    description:
      "Tulang punggung matematika yang mengubah pola data menjadi prediksi cerdas.",
    href: `${BASE_PATH}/linear-methods`,
    items: [],
  },
  {
    title: "Pemrograman AI",
    description:
      "Mengkode kecerdasan yang mengajarkan mesin berpikir dan memecahkan masalah kompleks.",
    href: `${BASE_PATH}/ai-programming`,
    items: [],
  },
  {
    title: "Neural Networks",
    description:
      "Otak digital yang meniru neuron manusia untuk mengenali pola dan membuat keputusan.",
    href: `${BASE_PATH}/neural-networks`,
    items: [],
  },
  {
    title: "Machine Learning",
    description:
      "Algoritma yang belajar dari pengalaman untuk memprediksi hasil masa depan secara otomatis.",
    href: `${BASE_PATH}/machine-learning`,
    items: [],
  },
  {
    title: "Optimisasi Nonlinear untuk AI",
    description:
      "Matematika lanjutan yang menemukan solusi optimal dalam ruang masalah AI yang kompleks.",
    href: `${BASE_PATH}/nonlinear-optimization`,
    items: [],
  },
  {
    title: "Advanced Machine Learning",
    description:
      "Teknik mutakhir yang mendorong batas kemampuan kecerdasan buatan.",
    href: `${BASE_PATH}/advanced-machine-learning`,
    items: [],
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
