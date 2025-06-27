import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Static Electricity",
    description:
      "Invisible force that makes hair stand up and enables touchscreen technology to work.",
    href: `${BASE_PATH}/static-electricity`,
    items: [],
  },
  {
    title: "Direct Current",
    description:
      "Foundation of all electronic devices from smartphones to electric cars changing the world.",
    href: `${BASE_PATH}/direct-current`,
    items: [],
  },
  {
    title: "Magnetism",
    description:
      "Mysterious force that guides compasses and powers electric motors in modern life.",
    href: `${BASE_PATH}/magnetism`,
    items: [],
  },
  {
    title: "Alternating Current",
    description:
      "Revolutionary technology that brings electricity to homes around the world.",
    href: `${BASE_PATH}/alternating-current`,
    items: [],
  },
  {
    title: "Electromagnetic Waves",
    description:
      "Invisible spectrum that enables WiFi, radio, and X-rays to transform civilization.",
    href: `${BASE_PATH}/electromagnetic-wave`,
    items: [],
  },
  {
    title: "Introduction to Modern Physics",
    description:
      "Gateway to understanding the universe that changes our view of reality.",
    href: `${BASE_PATH}/modern-physics-intro`,
    items: [],
  },
  {
    title: "Relativity",
    description:
      "Einstein's revolutionary theory revealing secrets of space, time, and speed of light.",
    href: `${BASE_PATH}/relativity`,
    items: [],
  },
  {
    title: "Quantum Phenomena",
    description:
      "Strange world of particles enabling lasers, LEDs, and future quantum computers.",
    href: `${BASE_PATH}/quantum-phenomena`,
    items: [],
  },
  {
    title: "Nuclear Physics and Radioactivity",
    description:
      "Tremendous atomic power that energizes stars and modern medical technology.",
    href: `${BASE_PATH}/nuclear-physics`,
    items: [],
  },
] as const;

export default enMaterials;
