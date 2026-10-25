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
    logo: "/logos/tum.png",
    name: "Technische Universität München",
  },
  { logo: "/logos/oth.png", name: "OTH Regensburg" },
  {
    logo: "/logos/itb.png",
    name: "Institut Teknologi Bandung",
  },
  { logo: "/logos/ui.png", name: "Universitas Indonesia" },
  {
    logo: "/logos/ugm.png",
    name: "Universitas Gadjah Mada",
  },
  {
    logo: "/logos/unair.png",
    name: "Universitas Airlangga",
  },
  {
    logo: "/logos/unpad.png",
    name: "Universitas Padjadjaran",
  },
  {
    logo: "/logos/undip.png",
    name: "Universitas Diponegoro",
  },
  {
    logo: "/logos/unhas.png",
    name: "Universitas Hasanuddin",
  },
  { logo: "/logos/ub.png", name: "Universitas Brawijaya" },
  {
    logo: "/logos/uns.png",
    name: "Universitas Sebelas Maret",
  },
  {
    logo: "/logos/upi.png",
    name: "Universitas Pendidikan Indonesia",
  },
  {
    logo: "/logos/nfbs.png",
    name: "Nurul Fikri Boarding School Bogor",
  },
  { logo: "/logos/ipb.png", name: "IPB University" },
  { logo: "/logos/usu.png", name: "Universitas Sumatera Utara" },
  { logo: "/logos/unand.png", name: "Universitas Andalas" },
  { logo: "/logos/unud.png", name: "Universitas Udayana" },
  { logo: "/logos/uny.png", name: "Universitas Negeri Yogyakarta" },
  { logo: "/logos/unsri.png", name: "Universitas Sriwijaya" },
  { logo: "/logos/telkom.png", name: "Telkom University" },
];
