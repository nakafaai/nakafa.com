import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Kolonialisme dan Perlawanan Bangsa Indonesia",
    description:
      "Perjuangan heroik melawan penjajah yang memupuk semangat kemerdekaan bangsa.",
    href: `${BASE_PATH}/colonialism-resistance`,
    items: [
      {
        title: "Keterkaitan Sejarah antara Situasi Regional dan Global",
        href: `${BASE_PATH}/colonialism-resistance/regional-global-history`,
      },
      {
        title: "Perlawanan Bangsa Indonesia Terhadap Kolonialisme",
        href: `${BASE_PATH}/colonialism-resistance/indonesian-resistance`,
      },
      {
        title: "Dampak Penjajahan di Negara Koloni",
        href: `${BASE_PATH}/colonialism-resistance/impact-colonialism`,
      },
    ],
  },
  {
    title: "Pergerakan Kebangsaan Indonesia",
    description:
      "Kebangkitan kesadaran nasional yang menyatukan nusantara dalam satu cita-cita.",
    href: `${BASE_PATH}/national-movement`,
    items: [
      {
        title: "Kebangkitan Bangsa Timur",
        href: `${BASE_PATH}/national-movement/eastern-renaissance`,
      },
      {
        title: "Munculnya Embrio Kebangsaan dan Nasionalisme",
        href: `${BASE_PATH}/national-movement/nationalism-embrio`,
      },
      {
        title: "Akhir Masa Negara Kolonial Belanda",
        href: `${BASE_PATH}/colonialism-resistance/end-colonialism`,
      },
    ],
  },
  {
    title: "Di Bawah Tirani Jepang",
    description:
      "Masa kelam yang paradoksnya mempercepat jalan menuju kemerdekaan Indonesia.",
    href: `${BASE_PATH}/under-japanese-rule`,
    items: [
      {
        title: "Masuknya Jepang dan Jatuhnya Hindia Belanda",
        href: `${BASE_PATH}/under-japanese-rule/japanese-dutch-fall`,
      },
      {
        title: "Penjajahan Jepang dan Transformasi Pemerintahan di Indonesia",
        href: `${BASE_PATH}/under-japanese-rule/japanese-transformation`,
      },
      {
        title: "Dampak Penjajahan Jepang di Berbagai Bidang",
        href: `${BASE_PATH}/under-japanese-rule/japanese-impact`,
      },
      {
        title: "Strategi Bangsa Indonesia Menghadapi Tirani Jepang",
        href: `${BASE_PATH}/under-japanese-rule/indonesian-strategy`,
      },
    ],
  },
  {
    title: "Proklamasi Kemerdekaan",
    description:
      "Momen bersejarah yang mengubah bangsa terjajah menjadi negara merdeka dan berdaulat.",
    href: `${BASE_PATH}/proclamation-independence`,
    items: [
      {
        title: "Kekalahan Jepang",
        href: `${BASE_PATH}/proclamation-independence/japanese-defeat`,
      },
      {
        title: "Menuju Proklamasi Kemerdekaan",
        href: `${BASE_PATH}/proclamation-independence/towards-proclamation`,
      },
      {
        title: "Detik-Detik Proklamasi",
        href: `${BASE_PATH}/proclamation-independence/proclamation-details`,
      },
      {
        title: "Sambutan terhadap Proklamasi Kemerdekaan",
        href: `${BASE_PATH}/proclamation-independence/reception`,
      },
    ],
  },
] as const;

export default idMaterials;
