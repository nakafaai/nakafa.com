import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Perubahan Sosial",
    description:
      "Kekuatan tak terhindarkan yang mengubah cara hidup manusia dari masa ke masa.",
    href: `${BASE_PATH}/social-change`,
    items: [
      {
        title: "Memahami Perubahan Sosial",
        href: `${BASE_PATH}/social-change/understanding`,
      },
      {
        title: "Teori Perubahan Sosial",
        href: `${BASE_PATH}/social-change/theories`,
      },
      {
        title: "Bentuk Perubahan Sosial",
        href: `${BASE_PATH}/social-change/forms`,
      },
      {
        title: "Dampak Perubahan Sosial",
        href: `${BASE_PATH}/social-change/impact`,
      },
    ],
  },
  {
    title: "Globalisasi dan Masyarakat Digital",
    description:
      "Revolusi konektivitas yang menyatukan dunia dalam satu jaringan digital raksasa.",
    href: `${BASE_PATH}/globalization-digital`,
    items: [
      {
        title: "Memahami Globalisasi",
        href: `${BASE_PATH}/globalization-digital/globalization`,
      },
      {
        title: "Perkembangan Masyarakat Digital",
        href: `${BASE_PATH}/globalization-digital/digital-development`,
      },
      {
        title: "Respons Masyarakat terhadap Globalisasi dan Era Digital",
        href: `${BASE_PATH}/globalization-digital/society-response`,
      },
    ],
  },
  {
    title: "Masalah Sosial Akibat Globalisasi dan Era Digital",
    description:
      "Tantangan baru yang muncul dari kemajuan teknologi dan keterhubungan global.",
    href: `${BASE_PATH}/global-digital-problems`,
    items: [
      {
        title: "Penyebab Masalah Sosial Akibat Globalisasi dan Era Digital",
        href: `${BASE_PATH}/global-digital-problems/causes`,
      },
      {
        title: "Ragam Masalah Sosial Akibat Globalisasi dan Era Digital",
        href: `${BASE_PATH}/global-digital-problems/variety`,
      },
      {
        title: "Upaya Mengatasi Masalah Akibat Globalisasi dan Era Digital",
        href: `${BASE_PATH}/global-digital-problems/solutions`,
      },
    ],
  },
  {
    title: "Pemberdayaan Komunitas Berbasis Kearifan Lokal",
    description:
      "Menggali kekuatan tradisi untuk membangun masa depan yang berkelanjutan.",
    href: `${BASE_PATH}/local-empowerment`,
    items: [
      {
        title: "Pemberdayaan dan Potensi Kearifan Lokal",
        href: `${BASE_PATH}/local-empowerment/potential`,
      },
      {
        title: "Berbagai Aksi Pemberdayaan Komunitas",
        href: `${BASE_PATH}/local-empowerment/actions`,
      },
      {
        title: "Tahapan Pemberdayaan Komunitas Lokal",
        href: `${BASE_PATH}/local-empowerment/steps`,
      },
    ],
  },
] as const;

export default idMaterials;
