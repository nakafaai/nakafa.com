import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Bilangan Berpangkat",
    description: "Kekuatan perkalian berulang dalam matematika.",
    href: `${BASE_PATH}/exponents`,
    items: [
      {
        title: "Pengertian Bilangan Berpangkat",
        href: `${BASE_PATH}/exponents/understanding`,
      },
      {
        title: "Sifat Perkalian Bilangan Berpangkat",
        href: `${BASE_PATH}/exponents/multiplication-props`,
      },
      {
        title: "Sifat Perpangkatan Bilangan Berpangkat",
        href: `${BASE_PATH}/exponents/power-props`,
      },
      {
        title: "Perpangkatan pada Perkalian Bilangan",
        href: `${BASE_PATH}/exponents/product-power`,
      },
      {
        title: "Bilangan Pangkat Nol dan Pangkat Negatif",
        href: `${BASE_PATH}/exponents/zero-negative`,
      },
      {
        title: "Bilangan Pecahan Berpangkat",
        href: `${BASE_PATH}/exponents/fractional`,
      },
      {
        title: "Mengubah Bilangan Berpangkat Pecahan ke dalam Bentuk Akar",
        href: `${BASE_PATH}/exponents/fraction-radical`,
      },
      {
        title: "Penjumlahan dan Pengurangan Bentuk Akar",
        href: `${BASE_PATH}/exponents/radical-add-sub`,
      },
      {
        title: "Perkalian Bentuk Akar",
        href: `${BASE_PATH}/exponents/radical-mult`,
      },
      {
        title: "Pembagian Bentuk Akar",
        href: `${BASE_PATH}/exponents/radical-div`,
      },
      {
        title: "Merasionalkan Penyebut",
        href: `${BASE_PATH}/exponents/rationalizing`,
      },
      {
        title: "Penulisan Bentuk Baku",
        href: `${BASE_PATH}/exponents/scientific-notation`,
      },
    ],
  },
  {
    title: "Teorema Pythagoras",
    description: "Rumus legendaris segitiga siku-siku.",
    href: `${BASE_PATH}/pythagorean-theorem`,
    items: [
      {
        title: "Menemukan Konsep Pythagoras",
        href: `${BASE_PATH}/pythagorean-theorem/concept`,
      },
      {
        title: "Segitiga Siku-Siku",
        href: `${BASE_PATH}/pythagorean-theorem/right-triangle`,
      },
      {
        title: "Teorema Pythagoras",
        href: `${BASE_PATH}/pythagorean-theorem/theorem`,
      },
      {
        title: "Kebalikan Teorema Pythagoras",
        href: `${BASE_PATH}/pythagorean-theorem/converse`,
      },
      {
        title: "Segitiga Istimewa",
        href: `${BASE_PATH}/pythagorean-theorem/special-triangles`,
      },
      {
        title: "Penerapan Teorema Pythagoras",
        href: `${BASE_PATH}/pythagorean-theorem/applications`,
      },
      {
        title: "Rumus Jarak",
        href: `${BASE_PATH}/pythagorean-theorem/distance`,
      },
    ],
  },
  {
    title: "Persamaan dan Pertidaksamaan Linier Satu Variabel",
    description: "Menemukan nilai tersembunyi dalam persamaan.",
    href: `${BASE_PATH}/linear-equations-inequalities`,
    items: [
      {
        title: "Konsep Persamaan Linier Satu Variabel",
        href: `${BASE_PATH}/linear-equations-inequalities/equation-concept`,
      },
      {
        title: "Menentukan Kalimat Terbuka dan Tertutup",
        href: `${BASE_PATH}/linear-equations-inequalities/open-closed`,
      },
      {
        title: "Menemukan bentuk umum dari Persamaan Linier Satu Variabel",
        href: `${BASE_PATH}/linear-equations-inequalities/general-form`,
      },
      {
        title: "Menyelesaikan Persamaan Linier Satu Variabel",
        href: `${BASE_PATH}/linear-equations-inequalities/solving-equations`,
      },
      {
        title: "Menemukan Konsep Pertidaksamaan Linier Satu Variabel",
        href: `${BASE_PATH}/linear-equations-inequalities/inequality-concept`,
      },
      {
        title:
          "Menyelesaikan Masalah terkait Pertidaksamaan Linier Satu Variabel",
        href: `${BASE_PATH}/linear-equations-inequalities/solving-inequalities`,
      },
    ],
  },
  {
    title: "Relasi dan Fungsi",
    description: "Hubungan spesial antara dua himpunan.",
    href: `${BASE_PATH}/relations-functions`,
    items: [
      {
        title: "Pengertian Himpunan",
        href: `${BASE_PATH}/relations-functions/set-definition`,
      },
      {
        title: "Penyajian Himpunan",
        href: `${BASE_PATH}/relations-functions/set-representation`,
      },
      {
        title: "Pengertian Relasi",
        href: `${BASE_PATH}/relations-functions/relation-definition`,
      },
      {
        title: "Penyajian Relasi",
        href: `${BASE_PATH}/relations-functions/relation-representation`,
      },
      {
        title: "Karakteristik Fungsi",
        href: `${BASE_PATH}/relations-functions/function-characteristics`,
      },
      {
        title: "Ciri-Ciri Fungsi",
        href: `${BASE_PATH}/relations-functions/function-features`,
      },
      {
        title: "Menentukan Banyak Fungsi yang Mungkin",
        href: `${BASE_PATH}/relations-functions/counting-functions`,
      },
      {
        title: "Bentuk Penyajian Fungsi",
        href: `${BASE_PATH}/relations-functions/function-forms`,
      },
      {
        title: "Nilai Fungsi dan Bentuk Fungsi",
        href: `${BASE_PATH}/relations-functions/function-values`,
      },
      {
        title: "Pengertian Korespondensi Satu-Satu",
        href: `${BASE_PATH}/relations-functions/one-to-one-def`,
      },
      {
        title: "Banyak Korespondensi Satu-Satu",
        href: `${BASE_PATH}/relations-functions/counting-one-to-one`,
      },
    ],
  },
  {
    title: "Persamaan Garis Lurus",
    description: "Menggambar jejak linear dalam koordinat.",
    href: `${BASE_PATH}/straight-line-equations`,
    items: [
      {
        title: "Grafik Persamaan Garis Lurus",
        href: `${BASE_PATH}/straight-line-equations/line-graph`,
      },
      {
        title: "Pengertian Kemiringan",
        href: `${BASE_PATH}/straight-line-equations/slope-definition`,
      },
      {
        title: "Mencari Kemiringan",
        href: `${BASE_PATH}/straight-line-equations/finding-slope`,
      },
      {
        title: "Mencari Persamaan Garis dari Kemiringan dan Titik",
        href: `${BASE_PATH}/straight-line-equations/finding-equation`,
      },
    ],
  },
  {
    title: "Statistika",
    description: "Menganalisis data untuk mengambil kesimpulan.",
    href: `${BASE_PATH}/statistics`,
    items: [
      {
        title: "Pemusatan Data",
        href: `${BASE_PATH}/statistics/centrality`,
      },
      {
        title: "Modus",
        href: `${BASE_PATH}/statistics/mode`,
      },
      {
        title: "Median",
        href: `${BASE_PATH}/statistics/median`,
      },
      {
        title: "Menentukan Median dengan Banyak Data Ganjil",
        href: `${BASE_PATH}/statistics/median-odd`,
      },
      {
        title: "Menentukan Median dengan Banyak Data Genap",
        href: `${BASE_PATH}/statistics/median-even`,
      },
      {
        title: "Menentukan Median dari Data yang Acak yang Heterogen",
        href: `${BASE_PATH}/statistics/median-random`,
      },
      {
        title: "Rata-Rata",
        href: `${BASE_PATH}/statistics/mean`,
      },
      {
        title: "Jangkauan",
        href: `${BASE_PATH}/statistics/range`,
      },
      {
        title: "Kuartil",
        href: `${BASE_PATH}/statistics/quartiles`,
      },
      {
        title: "Jangkauan Kuartil dan Simpangan Kuartil",
        href: `${BASE_PATH}/statistics/quartile-range`,
      },
    ],
  },
] as const;

export default idMaterials;
