import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Atomic Structure",
    description:
      "Understanding the fundamental building blocks of the universe that form everything around us.",
    href: `${BASE_PATH}/structure-matter`,
    items: [
      {
        title: "Ancient Greek Atomic Concept",
        href: `${BASE_PATH}/structure-matter/ancient-atom-concept`,
      },
      {
        title: "Atomic Reconceptualization",
        href: `${BASE_PATH}/structure-matter/reconceptualization-atom`,
      },
      {
        title: "Subatomic Particles",
        href: `${BASE_PATH}/structure-matter/subatomic-particles`,
      },
      {
        title: "Subatomic Particle Properties",
        href: `${BASE_PATH}/structure-matter/subatomic-particles-properties`,
      },
      {
        title: "Atomic Symbol",
        href: `${BASE_PATH}/structure-matter/atom-symbol`,
      },
      {
        title: "Ions",
        href: `${BASE_PATH}/structure-matter/ion`,
      },
      {
        title: "Isotopes",
        href: `${BASE_PATH}/structure-matter/isotope`,
      },
      {
        title: "Electron Configuration",
        href: `${BASE_PATH}/structure-matter/electron-configuration`,
      },
      {
        title: "Atomic Shell",
        href: `${BASE_PATH}/structure-matter/atom-shell`,
      },
      {
        title: "Valence Electrons",
        href: `${BASE_PATH}/structure-matter/valence-electron`,
      },
      {
        title: "Modern Periodic Table",
        href: `${BASE_PATH}/structure-matter/modern-periodic-table`,
      },
      {
        title: "Periodic Properties of Elements",
        href: `${BASE_PATH}/structure-matter/periodic-properties`,
      },
    ],
  },
  {
    title: "Basic Laws of Chemistry",
    description:
      "Golden rules governing all chemical reactions from medicines to rocket fuel.",
    href: `${BASE_PATH}/basic-chemistry-laws`,
    items: [
      {
        title: "Characteristics of Chemical Reactions",
        href: `${BASE_PATH}/basic-chemistry-laws/chemical-reaction-characteristics`,
      },
      {
        title: "Types of Chemical Reactions",
        href: `${BASE_PATH}/basic-chemistry-laws/types-chemical-reaction`,
      },
      {
        title: "Writing Chemical Reactions",
        href: `${BASE_PATH}/basic-chemistry-laws/writing-chemical-reactions`,
      },
      {
        title: "Four Basic Laws of Chemistry",
        href: `${BASE_PATH}/basic-chemistry-laws/four-basic-chemistry-laws`,
      },
      {
        title: "Applications of Basic Chemistry Laws",
        href: `${BASE_PATH}/basic-chemistry-laws/application-basic-chemistry-laws`,
      },
      {
        title: "Law of Constant Composition",
        href: `${BASE_PATH}/basic-chemistry-laws/law-constant-composition`,
      },
    ],
  },
  {
    title: "Green Chemistry",
    description:
      "Eco-friendly revolution in science to protect the planet while continuing innovation.",
    href: `${BASE_PATH}/green-chemistry`,
    items: [
      {
        title: "Definition of Green Chemistry",
        href: `${BASE_PATH}/green-chemistry/definition`,
      },
      {
        title: "Principles of Green Chemistry",
        href: `${BASE_PATH}/green-chemistry/principles`,
      },
      {
        title: "Chemical Processes in Daily Life",
        href: `${BASE_PATH}/green-chemistry/chemical-processes-daily-life`,
      },
      {
        title: "Green Chemistry Activities",
        href: `${BASE_PATH}/green-chemistry/green-chemistry-activities`,
      },
    ],
  },
] as const;

export default enMaterials;
