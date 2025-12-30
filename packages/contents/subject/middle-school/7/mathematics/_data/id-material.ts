import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Bilangan Bulat",
    description: "Dasar perhitungan untuk segala hal di dunia.",
    href: `${BASE_PATH}/integers`,
    items: [
      {
        title: "Apa itu Bilangan Bulat?",
        href: `${BASE_PATH}/integers/what-is-integer`,
      },
      {
        title: "Membandingkan Bilangan Bulat",
        href: `${BASE_PATH}/integers/comparing-integers`,
      },
      {
        title: "Operasi Penjumlahan dan Pengurangan Bilangan Bulat",
        href: `${BASE_PATH}/integers/addition-subtraction`,
      },
      {
        title: "Operasi Perkalian dan Pembagian Bilangan Bulat",
        href: `${BASE_PATH}/integers/multiplication-division`,
      },
      {
        title: "Faktor Bilangan Bulat Positif dan Negatif",
        href: `${BASE_PATH}/integers/positive-negative-factors`,
      },
      {
        title: "Faktor Persekutuan terbesar",
        href: `${BASE_PATH}/integers/greatest-common-divisor`,
      },
      {
        title: "Kelipatan Persekutuan terkecil",
        href: `${BASE_PATH}/integers/least-common-multiple`,
      },
    ],
  },
  {
    title: "Bilangan Rasional",
    description: "Presisi angka dalam pecahan dan desimal.",
    href: `${BASE_PATH}/rational-numbers`,
    items: [
      {
        title: "Apa itu Bilangan Rasional?",
        href: `${BASE_PATH}/rational-numbers/what-is-rational`,
      },
      {
        title: "Menyatakan Bilangan Rasional dalam Bentuk Pecahan dan Desimal",
        href: `${BASE_PATH}/rational-numbers/fractions-and-decimals`,
      },
      {
        title: "Membandingkan Bilangan Rasional",
        href: `${BASE_PATH}/rational-numbers/comparing-rationals`,
      },
      {
        title:
          "Operasi Penjumlahan dan Pengurangan Bilangan Rasional dalam Bentuk Pecahan",
        href: `${BASE_PATH}/rational-numbers/fraction-addition-subtraction`,
      },
      {
        title:
          "Operasi Penjumlahan dan Pengurangan Bilangan Rasional dalam Bentuk Desimal",
        href: `${BASE_PATH}/rational-numbers/decimal-addition-subtraction`,
      },
      {
        title:
          "Penjumlahan dan Pengurangan Bilangan Rasional yang Dinyatakan dalam Bentuk Pecahan dan Desimal",
        href: `${BASE_PATH}/rational-numbers/mixed-addition-subtraction`,
      },
      {
        title:
          "Perkalian Bilangan Rasional yang Dinyatakan dalam Bentuk Pecahan",
        href: `${BASE_PATH}/rational-numbers/fraction-multiplication`,
      },
      {
        title:
          "Perkalian dan Pembagian Bilangan Rasional yang Dinyatakan dalam Bentuk Desimal",
        href: `${BASE_PATH}/rational-numbers/decimal-multiplication-division`,
      },
      {
        title:
          "Perkalian dan Pembagian Bilangan Rasional yang Dinyatakan dalam Bentuk Pecahan dan Desimal",
        href: `${BASE_PATH}/rational-numbers/mixed-multiplication-division`,
      },
    ],
  },
  {
    title: "Rasio",
    description: "Memahami proporsi dan perbandingan nilai.",
    href: `${BASE_PATH}/ratio`,
    items: [
      {
        title: "Apa itu Rasio?",
        href: `${BASE_PATH}/ratio/what-is-ratio`,
      },
      {
        title: "Perbedaan Rasio dan Pecahan",
        href: `${BASE_PATH}/ratio/ratio-vs-fraction`,
      },
      {
        title: "Skala dan Rasio Ekuivalen",
        href: `${BASE_PATH}/ratio/scale-equivalent-ratio`,
      },
      {
        title: "Laju Perubahan Satuan",
        href: `${BASE_PATH}/ratio/unit-rate-change`,
      },
    ],
  },
  {
    title: "Bentuk Aljabar",
    description: "Bahasa simbol untuk pemecahan masalah kompleks.",
    href: `${BASE_PATH}/algebraic-forms`,
    items: [
      {
        title: "Unsur-Untuk Bentuk Aljabar",
        href: `${BASE_PATH}/algebraic-forms/algebraic-elements`,
      },
      {
        title: "Sifat-Sifat Aljabar",
        href: `${BASE_PATH}/algebraic-forms/algebraic-properties`,
      },
      {
        title: "Operasi Aljabar",
        href: `${BASE_PATH}/algebraic-forms/algebraic-operations`,
      },
      {
        title: "Pemodelan dalam Bentuk Aljabar",
        href: `${BASE_PATH}/algebraic-forms/algebraic-modeling`,
      },
    ],
  },
  {
    title: "Kesebangunan",
    description: "Geometri skala dalam peta dan desain.",
    href: `${BASE_PATH}/similarity`,
    items: [
      {
        title: "Hubungan Antar Sudut",
        href: `${BASE_PATH}/similarity/angle-relationships`,
      },
      {
        title: "Besar Sudut Persimpangan",
        href: `${BASE_PATH}/similarity/intersection-angles`,
      },
      {
        title: "Arti Kesebangunan",
        href: `${BASE_PATH}/similarity/meaning-of-similarity`,
      },
      {
        title: "Memperbesar dan Memperkecil",
        href: `${BASE_PATH}/similarity/enlargement-and-reduction`,
      },
      {
        title: "Kesebangunan pada Segitiga",
        href: `${BASE_PATH}/similarity/triangle-similarity`,
      },
      {
        title: "Memperbesar dan Memperkecil secara Proporsional",
        href: `${BASE_PATH}/similarity/proportional-scaling`,
      },
    ],
  },
  {
    title: "Data dan Diagram",
    description: "Mengubah angka menjadi cerita visual.",
    href: `${BASE_PATH}/data-diagrams`,
    items: [
      {
        title: "Investigasi Statistika",
        href: `${BASE_PATH}/data-diagrams/statistical-investigation`,
      },
      {
        title:
          "Formulasi Pertanyaan, Pengumpulan, Pengolahan, dan Interpretasi Data",
        href: `${BASE_PATH}/data-diagrams/data-handling-cycle`,
      },
      {
        title: "Macam-Macam Data",
        href: `${BASE_PATH}/data-diagrams/types-of-data`,
      },
      {
        title: "Membedakan Jenis Data",
        href: `${BASE_PATH}/data-diagrams/distinguishing-data`,
      },
      {
        title: "Diagram dalam Statistika",
        href: `${BASE_PATH}/data-diagrams/statistical-diagrams`,
      },
      {
        title: "Membaca dan Menginterpretasikan Diagram",
        href: `${BASE_PATH}/data-diagrams/reading-diagrams`,
      },
      {
        title: "Diagram Batang",
        href: `${BASE_PATH}/data-diagrams/bar-charts`,
      },
      {
        title: "Mengumpulkan dan Menampilkan Data dalam Diagram Batang",
        href: `${BASE_PATH}/data-diagrams/creating-bar-charts`,
      },
      {
        title: "Diagram Lingkaran",
        href: `${BASE_PATH}/data-diagrams/pie-charts`,
      },
      {
        title: "Menentukan Persentase pada Diagram Lingkaran",
        href: `${BASE_PATH}/data-diagrams/pie-chart-percentages`,
      },
      {
        title: "Memilih Diagram yang Tepat",
        href: `${BASE_PATH}/data-diagrams/choosing-diagrams`,
      },
    ],
  },
] as const;

export default idMaterials;
