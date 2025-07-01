import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Pertumbuhan dan Pembangunan Ekonomi",
    description:
      "Mesin pengubah masyarakat dari kemiskinan menuju kemakmuran di era digital.",
    href: `${BASE_PATH}/growth-development`,
    items: [
      {
        title: "Pertumbuhan Ekonomi",
        href: `${BASE_PATH}/growth-development/economic-growth`,
      },
      {
        title: "Pembangunan Ekonomi",
        href: `${BASE_PATH}/growth-development/economic-development`,
      },
      {
        title: "Ekonomi Digital",
        href: `${BASE_PATH}/growth-development/digital-economy`,
      },
    ],
  },
  {
    title: "Ekonomi Internasional",
    description:
      "Jaring ekonomi global yang menghubungkan bangsa melalui perdagangan dan kerjasama.",
    href: `${BASE_PATH}/international-economy`,
    items: [
      {
        title: "Konsep Perdagangan Internasional",
        href: `${BASE_PATH}/international-economy/concept-trade`,
      },
      {
        title: "Manfaat Perdagangan Internasional",
        href: `${BASE_PATH}/international-economy/benefits-trade`,
      },
      {
        title: "Faktor Pendorong Perdagangan Internasional",
        href: `${BASE_PATH}/international-economy/promoting-factors-trade`,
      },
      {
        title: "Faktor Penghambat Perdagangan Internasional",
        href: `${BASE_PATH}/international-economy/limiting-factors-trade`,
      },
      {
        title: "Teori Perdagangan Internasional",
        href: `${BASE_PATH}/international-economy/theory-trade`,
      },
      {
        title: "Kebijakan Perdagangan Internasional",
        href: `${BASE_PATH}/international-economy/policy-trade`,
      },
      {
        title: "Neraca Pembayaran",
        href: `${BASE_PATH}/international-economy/balance-payment`,
      },
      {
        title: "Kerja Sama Ekonomi Internasional",
        href: `${BASE_PATH}/international-economy/economic-cooperation`,
      },
    ],
  },
  {
    title: "APBN dan APBD",
    description:
      "Cetak biru keuangan yang menentukan layanan publik, infrastruktur, dan prioritas bangsa.",
    href: `${BASE_PATH}/apbn-apbd`,
    items: [
      {
        title: "APBN",
        href: `${BASE_PATH}/apbn-apbd/apbn`,
      },
      {
        title: "APBD",
        href: `${BASE_PATH}/apbn-apbd/apbd`,
      },
      {
        title: "Perpajakan",
        href: `${BASE_PATH}/apbn-apbd/taxation`,
      },
    ],
  },
  {
    title: "Akuntansi",
    description:
      "Bahasa bisnis yang mengungkap kesehatan keuangan dan memandu keputusan cerdas.",
    href: `${BASE_PATH}/accounting`,
    items: [
      {
        title: "Persamaan Dasar Akuntansi",
        href: `${BASE_PATH}/accounting/accounting-equation`,
      },
      {
        title: "Laporan Keuangan",
        href: `${BASE_PATH}/accounting/financial-report`,
      },
    ],
  },
] as const;

export default idMaterials;
