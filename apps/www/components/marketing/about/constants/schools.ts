import { Schema } from "effect";

/**
 * A school or campus on the medal wall: its name, the short mark that stands in
 * its medal, and its logo in the public folder when there is one.
 */
const SchoolSchema = Schema.Struct({
  logo: Schema.optionalKey(Schema.String),
  mark: Schema.String,
  name: Schema.String,
});

/** One school or campus on the medal wall. */
export type School = typeof SchoolSchema.Type;

/** The twenty schools and campuses of the wall, in the order of the design. */
export const schools: readonly School[] = [
  {
    logo: "/logos/tum.png",
    mark: "TUM",
    name: "Technische Universität München",
  },
  { logo: "/logos/oth.png", mark: "OTH", name: "OTH Regensburg" },
  {
    logo: "/logos/itb.png",
    mark: "ITB",
    name: "Institut Teknologi Bandung",
  },
  { logo: "/logos/ui.png", mark: "UI", name: "Universitas Indonesia" },
  {
    logo: "/logos/ugm.png",
    mark: "UGM",
    name: "Universitas Gadjah Mada",
  },
  {
    logo: "/logos/unair.png",
    mark: "UNAIR",
    name: "Universitas Airlangga",
  },
  {
    logo: "/logos/unpad.png",
    mark: "UNPAD",
    name: "Universitas Padjadjaran",
  },
  {
    logo: "/logos/undip.png",
    mark: "UNDIP",
    name: "Universitas Diponegoro",
  },
  {
    logo: "/logos/unhas.png",
    mark: "UNHAS",
    name: "Universitas Hasanuddin",
  },
  { logo: "/logos/ub.png", mark: "UB", name: "Universitas Brawijaya" },
  {
    logo: "/logos/uns.png",
    mark: "UNS",
    name: "Universitas Sebelas Maret",
  },
  {
    logo: "/logos/upi.png",
    mark: "UPI",
    name: "Universitas Pendidikan Indonesia",
  },
  {
    logo: "/logos/nfbs.png",
    mark: "NF",
    name: "Nurul Fikri Boarding School Bogor",
  },
  { mark: "IPB", name: "IPB University" },
  { mark: "USU", name: "Universitas Sumatera Utara" },
  { mark: "UNAND", name: "Universitas Andalas" },
  { mark: "UNUD", name: "Universitas Udayana" },
  { mark: "UNY", name: "Universitas Negeri Yogyakarta" },
  { mark: "UNSRI", name: "Universitas Sriwijaya" },
  { mark: "TELKOM", name: "Telkom University" },
];
