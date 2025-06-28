import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const idMaterials: MaterialList = [
  {
    title: "Menjelajah Sel",
    description:
      "Unit dasar kehidupan yang mengendalikan semua proses dari metabolisme hingga reproduksi.",
    href: `${BASE_PATH}/explore-cell`,
    items: [
      {
        title: "Apa itu Sel?",
        href: `${BASE_PATH}/explore-cell/what-is-cell`,
      },
      {
        title: "Struktur Sel",
        href: `${BASE_PATH}/explore-cell/structure-cell`,
      },
      {
        title: "Keterkaitan antara Struktur dan Fungsi Sel",
        href: `${BASE_PATH}/explore-cell/structure-function-relationship`,
      },
      {
        title: "Komposisi Sel",
        href: `${BASE_PATH}/explore-cell/composition-cell`,
      },
    ],
  },
  {
    title: "Pergerakan Zat melalui Membran Sel",
    description:
      "Mekanisme vital yang mengatur keluar masuk molekul untuk kelangsungan hidup sel.",
    href: `${BASE_PATH}/cell-membrane`,
    items: [
      {
        title: "Transpor Pasif",
        href: `${BASE_PATH}/cell-membrane/passive-transport`,
      },
      {
        title: "Transpor Aktif",
        href: `${BASE_PATH}/cell-membrane/active-transport`,
      },
    ],
  },
  {
    title: "Proses Pengaturan pada Tumbuhan",
    description:
      "Sistem kompleks yang memungkinkan tumbuhan tumbuh, bereproduksi, dan beradaptasi.",
    href: `${BASE_PATH}/plant-regulation`,
    items: [
      {
        title: "Jaringan",
        href: `${BASE_PATH}/plant-regulation/tissue`,
      },
      {
        title: "Organ",
        href: `${BASE_PATH}/plant-regulation/organ`,
      },
      {
        title: "Sistem Organ",
        href: `${BASE_PATH}/plant-regulation/organ-system`,
      },
      {
        title: "Transpor pada Tumbuhan",
        href: `${BASE_PATH}/plant-regulation/transport`,
      },
      {
        title: "Reproduksi pada Tumbuhan",
        href: `${BASE_PATH}/plant-regulation/reproduction`,
      },
      {
        title: "Iritabilitas pada Tumbuhan",
        href: `${BASE_PATH}/plant-regulation/irritability`,
      },
    ],
  },
  {
    title: "Transpor dan Pertukaran Zat pada Manusia",
    description:
      "Jaringan transportasi canggih yang mengirimkan oksigen dan nutrisi ke seluruh tubuh.",
    href: `${BASE_PATH}/human-exchange`,
    items: [
      {
        title: "Struktur Tubuh untuk Pertukaran dan Transpor Zat",
        href: `${BASE_PATH}/human-exchange/body-structure`,
      },
      {
        title: "Proses Pertukaran dan Transpor Zat",
        href: `${BASE_PATH}/human-exchange/exchange-transport`,
      },
      {
        title: "Kelainan pada Pertukaran dan Transpor Zat",
        href: `${BASE_PATH}/human-exchange/abnormalities`,
      },
    ],
  },
  {
    title: "Sistem Pertahanan Tubuh terhadap Penyakit",
    description:
      "Pasukan elit tubuh yang melawan bakteri, virus, dan ancaman kesehatan lainnya.",
    href: `${BASE_PATH}/human-defense`,
    items: [
      {
        title: "Sistem Pertahanan Eksternal dan Internal",
        href: `${BASE_PATH}/human-defense/external-internal-defense`,
      },
      {
        title: "Komponen Sistem Pertahanan Tubuh",
        href: `${BASE_PATH}/human-defense/components`,
      },
      {
        title: "Imunitas Tubuh dan Kelainannya",
        href: `${BASE_PATH}/human-defense/immunity`,
      },
    ],
  },
  {
    title: "Mobilitas pada Manusia",
    description:
      "Koordinasi sempurna antara otak, saraf, dan otot untuk setiap gerakan tubuh.",
    href: `${BASE_PATH}/human-mobility`,
    items: [
      {
        title: "Struktur Sistem Saraf",
        href: `${BASE_PATH}/human-mobility/nervous-system`,
      },
      {
        title: "Fungsi Sistem Saraf",
        href: `${BASE_PATH}/human-mobility/nervous-system-function`,
      },
      {
        title: "Struktur Sistem Gerak",
        href: `${BASE_PATH}/human-mobility/muscular-system`,
      },
      {
        title: "Fungsi Sistem Gerak",
        href: `${BASE_PATH}/human-mobility/muscular-system-function`,
      },
      {
        title: "Kelainan pada Sistem Gerak",
        href: `${BASE_PATH}/human-mobility/muscular-system-abnormalities`,
      },
      {
        title: "Keterkaitan antara Sistem Saraf dan Sistem Gerak",
        href: `${BASE_PATH}/human-mobility/nervous-muscular-relationship`,
      },
    ],
  },
  {
    title: "Hormon dalam Reproduksi Manusia",
    description:
      "Pesan kimia yang mengendalikan perkembangan seksual dan siklus reproduksi manusia.",
    href: `${BASE_PATH}/reproduction-hormone`,
    items: [
      {
        title: "Struktur Kelenjar Endokrin",
        href: `${BASE_PATH}/reproduction-hormone/endocrine-gland`,
      },
      {
        title: "Fungsi Kelenjar Endokrin",
        href: `${BASE_PATH}/reproduction-hormone/endocrine-gland-function`,
      },
      {
        title: "Peran Hormon dalam Reproduksi",
        href: `${BASE_PATH}/reproduction-hormone/hormone-function`,
      },
      {
        title: "Keterkaitan Struktur Organ pada Sistem Reproduksi",
        href: `${BASE_PATH}/reproduction-hormone/organ-relationship`,
      },
    ],
  },
  {
    title: "Tumbuh Kembang Makhluk Hidup",
    description:
      "Proses menakjubkan transformasi makhluk hidup dari lahir hingga dewasa.",
    href: `${BASE_PATH}/growth-development`,
    items: [
      {
        title: "Fenomena Pertumbuhan",
        href: `${BASE_PATH}/growth-development/growth-phenomena`,
      },
      {
        title: "Fenomena Perkembangan",
        href: `${BASE_PATH}/growth-development/development-phenomena`,
      },
      {
        title: "Faktor yang Mempengaruhi Pertumbuhan",
        href: `${BASE_PATH}/growth-development/growth-factors`,
      },
      {
        title: "Faktor yang Mempengaruhi Perkembangan",
        href: `${BASE_PATH}/growth-development/development-factors`,
      },
    ],
  },
] as const;

export default idMaterials;
