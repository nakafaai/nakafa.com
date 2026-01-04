import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Sistem Persamaan Linear Dua Variabel",
    description:
      "Menyelesaikan masalah dengan dua variabel yang saling terkait.",
    href: `${BASE_PATH}/linear-equations-two-variables`,
    items: [
      {
        title: "Konsep Persamaan Linear Dua Variabel",
        href: `${BASE_PATH}/linear-equations-two-variables/concept`,
      },
      {
        title: "Memodelkan Persamaan Linear Dua Variabel",
        href: `${BASE_PATH}/linear-equations-two-variables/modeling`,
      },
      {
        title: "Penyelesaian Persamaan Linear Dua Variabel",
        href: `${BASE_PATH}/linear-equations-two-variables/solving`,
      },
      {
        title: "Konsep Sistem Persamaan Linear Dua Variabel",
        href: `${BASE_PATH}/linear-equations-two-variables/system-concept`,
      },
      {
        title: "Metode Grafik",
        href: `${BASE_PATH}/linear-equations-two-variables/graph-method`,
      },
      {
        title: "Metode Substitusi",
        href: `${BASE_PATH}/linear-equations-two-variables/substitution`,
      },
      {
        title: "Metode Eliminasi",
        href: `${BASE_PATH}/linear-equations-two-variables/elimination`,
      },
      {
        title: "Metode Campuran",
        href: `${BASE_PATH}/linear-equations-two-variables/combined`,
      },
    ],
  },
  {
    title: "Bangun Ruang",
    description: "Menjelajahi volume dan luas permukaan objek 3D.",
    href: `${BASE_PATH}/solid-geometry`,
    items: [
      {
        title: "Jenis-Jenis Bangun Ruang",
        href: `${BASE_PATH}/solid-geometry/types`,
      },
      {
        title: "Jaring-Jaring Bangun Ruang",
        href: `${BASE_PATH}/solid-geometry/nets`,
      },
      {
        title: "Klasifikasi Bangun Ruang dan Jaring-Jaring",
        href: `${BASE_PATH}/solid-geometry/classification`,
      },
      {
        title: "Luas Permukaan Prisma, Balok, dan Kubus",
        href: `${BASE_PATH}/solid-geometry/surface-area-prism`,
      },
      {
        title: "Luas Permukaan Limas",
        href: `${BASE_PATH}/solid-geometry/surface-area-pyramid`,
      },
      {
        title:
          "Pengaruh Perubahan Skala Bangun Ruang Sisi Datar terhadap Luas Permukaannya",
        href: `${BASE_PATH}/solid-geometry/scale-effect-flat`,
      },
      {
        title: "Apa itu Volume?",
        href: `${BASE_PATH}/solid-geometry/volume-definition`,
      },
      {
        title: "Menghitung Volume Kubus, Balok, dan Prisma",
        href: `${BASE_PATH}/solid-geometry/volume-prism`,
      },
      {
        title: "Volume Susunan Kubus-Kubus Satuan",
        href: `${BASE_PATH}/solid-geometry/volume-unit-cubes`,
      },
      {
        title: "Volume Akuarium",
        href: `${BASE_PATH}/solid-geometry/volume-aquarium`,
      },
      {
        title: "Volume Limas",
        href: `${BASE_PATH}/solid-geometry/volume-pyramid`,
      },
      {
        title: "Membangun Piramida Segi Enam Beraturan",
        href: `${BASE_PATH}/solid-geometry/building-pyramid`,
      },
      {
        title:
          "Pengaruh Perubahan Skala Bangun Ruang Sisi Datar terhadap Volumenya",
        href: `${BASE_PATH}/solid-geometry/volume-scale-flat`,
      },
      {
        title: "Definisi Lingkaran",
        href: `${BASE_PATH}/solid-geometry/circle-definition`,
      },
      {
        title: "Keliling Lingkaran",
        href: `${BASE_PATH}/solid-geometry/circumference`,
      },
      {
        title: "Membandingkan Keliling dan Panjang Diameter",
        href: `${BASE_PATH}/solid-geometry/compare-circumference`,
      },
      {
        title: "Menentukan Keliling Lingkaran",
        href: `${BASE_PATH}/solid-geometry/determine-circumference`,
      },
      {
        title: "Menentukan Luas Lingkaran",
        href: `${BASE_PATH}/solid-geometry/determine-area`,
      },
      {
        title: "Menentukan Panjang Busur Lingkaran",
        href: `${BASE_PATH}/solid-geometry/arc-length`,
      },
      {
        title: "Mengukur Panjang Jalan",
        href: `${BASE_PATH}/solid-geometry/road-length`,
      },
      {
        title: "Menentukan Luas Juring Lingkaran",
        href: `${BASE_PATH}/solid-geometry/sector-area`,
      },
      {
        title: "Luas Permukaan Tabung",
        href: `${BASE_PATH}/solid-geometry/surface-area-cylinder`,
      },
      {
        title: "Luas Permukaan Kerucut",
        href: `${BASE_PATH}/solid-geometry/surface-area-cone`,
      },
      {
        title: "Luas Permukaan Bola",
        href: `${BASE_PATH}/solid-geometry/surface-area-sphere`,
      },
      {
        title:
          "Pengaruh Perubahan Skala Bangun Ruang Sisi Lengkung terhadap Luas Permukaannya",
        href: `${BASE_PATH}/solid-geometry/scale-effect-curved`,
      },
      {
        title: "Volume Tabung",
        href: `${BASE_PATH}/solid-geometry/volume-cylinder`,
      },
      {
        title: "Volume Kerucut",
        href: `${BASE_PATH}/solid-geometry/volume-cone`,
      },
      {
        title: "Kerucut dalam Prisma",
        href: `${BASE_PATH}/solid-geometry/cone-prism`,
      },
      {
        title: "Menemukan Volume Bola",
        href: `${BASE_PATH}/solid-geometry/volume-sphere`,
      },
      {
        title:
          "Pengaruh Perubahan Skala Bangun Ruang Sisi Lengkung terhadap Volumenya",
        href: `${BASE_PATH}/solid-geometry/volume-scale-curved`,
      },
    ],
  },
  {
    title: "Transformasi Geometri",
    description: "Memindahkan dan mengubah bentuk geometri.",
    href: `${BASE_PATH}/geometric-transformation`,
    items: [
      {
        title: "Apa itu Translasi?",
        href: `${BASE_PATH}/geometric-transformation/translation-definition`,
      },
      {
        title: "Translasi sebuah Titik Koordinat",
        href: `${BASE_PATH}/geometric-transformation/point-translation`,
      },
      {
        title: "Mentranslasikan sebuah Bangun Datar",
        href: `${BASE_PATH}/geometric-transformation/shape-translation`,
      },
      {
        title: "Mentranslasikan sebuah Garis Lurus",
        href: `${BASE_PATH}/geometric-transformation/line-translation`,
      },
      {
        title: "Apa itu Refleksi?",
        href: `${BASE_PATH}/geometric-transformation/reflection-definition`,
      },
      {
        title: "Refleksi Titik Terhadap Garis",
        href: `${BASE_PATH}/geometric-transformation/point-reflection`,
      },
      {
        title: "Sifat Refleksi Titik Terhadap Garis",
        href: `${BASE_PATH}/geometric-transformation/point-reflection-props`,
      },
      {
        title: "Sifat Refleksi Ruas Garis",
        href: `${BASE_PATH}/geometric-transformation/segment-reflection-props`,
      },
      {
        title: "Refleksi terhadap Sumbu x, Sumbu y, dan Titik Asal (0,0)",
        href: `${BASE_PATH}/geometric-transformation/axis-reflection`,
      },
      {
        title: "Merefleksikan sebuah Bangun Datar",
        href: `${BASE_PATH}/geometric-transformation/shape-reflection`,
      },
      {
        title: "Merefleksikan Sebuah Ruas Garis",
        href: `${BASE_PATH}/geometric-transformation/segment-reflection`,
      },
      {
        title: "Refleksi Persamaan Garis",
        href: `${BASE_PATH}/geometric-transformation/equation-reflection`,
      },
      {
        title: "Refleksi terhadap Garis y = x dan Garis y = -x",
        href: `${BASE_PATH}/geometric-transformation/line-y-reflection`,
      },
      {
        title: "Merefleksikan sebuah Titik Koordinat",
        href: `${BASE_PATH}/geometric-transformation/coordinate-reflection`,
      },
      {
        title: "Refleksi terhadap Garis x = k",
        href: `${BASE_PATH}/geometric-transformation/reflection-xk`,
      },
      {
        title: "Apa itu Rotasi?",
        href: `${BASE_PATH}/geometric-transformation/rotation-definition`,
      },
      {
        title: "Pusat dan Arah Rotasi",
        href: `${BASE_PATH}/geometric-transformation/rotation-center-direction`,
      },
      {
        title: "Rotasi terhadap Titik Pusat (0,0)",
        href: `${BASE_PATH}/geometric-transformation/rotation-origin`,
      },
      {
        title: "Merotasikan Segitiga",
        href: `${BASE_PATH}/geometric-transformation/triangle-rotation`,
      },
      {
        title: "Karakteristik Translasi, Refleksi, dan Rotasi",
        href: `${BASE_PATH}/geometric-transformation/transformation-props`,
      },
      {
        title: "Apa itu Kekongruenan?",
        href: `${BASE_PATH}/geometric-transformation/congruence-definition`,
      },
      {
        title: "Kekongruenan pada Segi Banyak",
        href: `${BASE_PATH}/geometric-transformation/polygon-congruence`,
      },
      {
        title: "Kekongruenan Segitiga",
        href: `${BASE_PATH}/geometric-transformation/triangle-congruence`,
      },
      {
        title: "Apa itu Dilatasi?",
        href: `${BASE_PATH}/geometric-transformation/dilation-definition`,
      },
      {
        title: "Faktor Skala",
        href: `${BASE_PATH}/geometric-transformation/scale-factor`,
      },
      {
        title: "Menggambar Bayangan Hasil Dilatasi",
        href: `${BASE_PATH}/geometric-transformation/drawing-dilation`,
      },
      {
        title: "Dilatasi terhadap [O,k]",
        href: `${BASE_PATH}/geometric-transformation/dilation-ok`,
      },
      {
        title: "Dilatasi terhadap [P(a,b), k]",
        href: `${BASE_PATH}/geometric-transformation/dilation-pk`,
      },
    ],
  },
  {
    title: "Peluang dan Pemilihan Sampel",
    description: "Memprediksi kemungkinan dan memahami pengambilan sampel.",
    href: `${BASE_PATH}/probability-sampling`,
    items: [
      {
        title: "Konsep Peluang",
        href: `${BASE_PATH}/probability-sampling/concept`,
      },
      {
        title: "Dasar-Dasar Peluang",
        href: `${BASE_PATH}/probability-sampling/basics`,
      },
      {
        title: "Menentukan Ruang Sampel",
        href: `${BASE_PATH}/probability-sampling/sample-space`,
      },
      {
        title: "Peluang Suatu Kejadian",
        href: `${BASE_PATH}/probability-sampling/event-probability`,
      },
      {
        title: "Rentang Nilai Peluang",
        href: `${BASE_PATH}/probability-sampling/probability-range`,
      },
      {
        title: "Apa itu Peluang Empiris?",
        href: `${BASE_PATH}/probability-sampling/empirical-probability`,
      },
      {
        title: "Frekuensi Relatif",
        href: `${BASE_PATH}/probability-sampling/relative-frequency`,
      },
      {
        title: "Hubungan Antara Frekuensi Relatif dan Peluang Teoretis",
        href: `${BASE_PATH}/probability-sampling/frequency-theoretical`,
      },
      {
        title: "Menebak Ruang Sampel",
        href: `${BASE_PATH}/probability-sampling/guessing-sample-space`,
      },
      {
        title: "Frekuensi Harapan",
        href: `${BASE_PATH}/probability-sampling/expected-frequency`,
      },
      {
        title: "Populasi dan Sampel",
        href: `${BASE_PATH}/probability-sampling/population-sample`,
      },
      {
        title: "Sampel Representatif",
        href: `${BASE_PATH}/probability-sampling/representative-sample`,
      },
      {
        title: "Sampel Acak",
        href: `${BASE_PATH}/probability-sampling/random-sample`,
      },
    ],
  },
] as const;

export default idMaterials;
