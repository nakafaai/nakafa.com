import { Schema } from "effect";

/**
 * A school or campus on the medal wall: its name and its logo, a square image
 * of 160 px in the public folder.
 */
const SchoolSchema = Schema.Struct({
  logo: Schema.String,
  name: Schema.String,
});

/** One school or campus on the medal wall. */
export type School = typeof SchoolSchema.Type;

/** The twenty schools and campuses of the wall, in the order of the design. */
export const schools: readonly School[] = [
  {
    logo: "/logos/tum.webp",
    name: "Technische Universität München",
  },
  { logo: "/logos/oth.webp", name: "OTH Regensburg" },
  {
    logo: "/logos/itb.webp",
    name: "Institut Teknologi Bandung",
  },
  { logo: "/logos/ui.webp", name: "Universitas Indonesia" },
  {
    logo: "/logos/ugm.webp",
    name: "Universitas Gadjah Mada",
  },
  {
    logo: "/logos/unair.webp",
    name: "Universitas Airlangga",
  },
  {
    logo: "/logos/unpad.webp",
    name: "Universitas Padjadjaran",
  },
  {
    logo: "/logos/undip.webp",
    name: "Universitas Diponegoro",
  },
  {
    logo: "/logos/unhas.webp",
    name: "Universitas Hasanuddin",
  },
  { logo: "/logos/ub.webp", name: "Universitas Brawijaya" },
  {
    logo: "/logos/uns.webp",
    name: "Universitas Sebelas Maret",
  },
  {
    logo: "/logos/upi.webp",
    name: "Universitas Pendidikan Indonesia",
  },
  {
    logo: "/logos/nfbs.webp",
    name: "Nurul Fikri Boarding School Bogor",
  },
  { logo: "/logos/ipb.webp", name: "IPB University" },
  { logo: "/logos/usu.webp", name: "Universitas Sumatera Utara" },
  { logo: "/logos/unand.webp", name: "Universitas Andalas" },
  { logo: "/logos/unud.webp", name: "Universitas Udayana" },
  { logo: "/logos/uny.webp", name: "Universitas Negeri Yogyakarta" },
  { logo: "/logos/unsri.webp", name: "Universitas Sriwijaya" },
  { logo: "/logos/telkom.webp", name: "Telkom University" },
];
