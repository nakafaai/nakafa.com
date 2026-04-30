import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from "@repo/contents/subject/high-school/10/physics/_data";

const idMaterials: MaterialList = [
  {
    title: "Pengukuran dalam Kerja Ilmiah",
    description:
      "Fondasi semua penemuan sains dan teknologi modern melalui pengukuran yang akurat.",
    href: `${BASE_PATH}/measurement`,
    items: [
      {
        title: "Macam-macam Alat Ukur",
        href: `${BASE_PATH}/measurement/tools`,
      },
      {
        title: "Besaran",
        href: `${BASE_PATH}/measurement/quantity`,
      },
      {
        title: "Sistem Satuan",
        href: `${BASE_PATH}/measurement/unit`,
      },
      {
        title: "Dimensi",
        href: `${BASE_PATH}/measurement/dimension`,
      },
      {
        title: "Aturan Angka Penting",
        href: `${BASE_PATH}/measurement/significant-figures`,
      },
      {
        title: "Notasi Ilmiah",
        href: `${BASE_PATH}/measurement/notation`,
      },
      {
        title: "Nilai Ketidakpastian pada Pengukuran Berulang",
        href: `${BASE_PATH}/measurement/uncertainty`,
      },
    ],
  },
  {
    title: "Energi Terbarukan",
    description:
      "Membaca masa depan listrik bersih dari Matahari, angin, air, panas bumi, dan keputusan energi yang bertanggung jawab.",
    href: `${BASE_PATH}/renewable-energy`,
    items: [
      {
        title: "Energi",
        href: `${BASE_PATH}/renewable-energy/energy`,
      },
      {
        title: "Bentuk-bentuk Energi",
        href: `${BASE_PATH}/renewable-energy/energy-forms`,
      },
      {
        title: "Hukum Kekekalan Energi",
        href: `${BASE_PATH}/renewable-energy/energy-conservation`,
      },
      {
        title: "Konversi Energi",
        href: `${BASE_PATH}/renewable-energy/energy-transformation`,
      },
      {
        title: "Urgensi Isu Kebutuhan Energi",
        href: `${BASE_PATH}/renewable-energy/energy-urgency`,
      },
      {
        title: "Sumber Energi",
        href: `${BASE_PATH}/renewable-energy/energy-sources`,
      },
      {
        title: "Sumber Energi Terbarukan",
        href: `${BASE_PATH}/renewable-energy/renewable-sources`,
      },
      {
        title: "Sumber Energi Tak Terbarukan",
        href: `${BASE_PATH}/renewable-energy/non-renewable-sources`,
      },
      {
        title: "Dampak Eksplorasi dan Penggunaan Energi",
        href: `${BASE_PATH}/renewable-energy/energy-impact`,
      },
      {
        title: "Upaya Pemenuhan Kebutuhan Energi",
        href: `${BASE_PATH}/renewable-energy/energy-solutions`,
      },
    ],
  },
] as const;

export default idMaterials;
