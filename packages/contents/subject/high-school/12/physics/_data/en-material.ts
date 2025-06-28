import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Static Electricity",
    description:
      "Invisible force that makes hair stand up and enables touchscreen technology to work.",
    href: `${BASE_PATH}/static-electricity`,
    items: [
      {
        title: "Electric Force",
        href: `${BASE_PATH}/static-electricity/electric-force`,
      },
      {
        title: "Coulomb's Law",
        href: `${BASE_PATH}/static-electricity/coulomb-law`,
      },
      {
        title: "Resultant Force",
        href: `${BASE_PATH}/static-electricity/resultant-force`,
      },
      {
        title: "Point Charge Electric Field",
        href: `${BASE_PATH}/static-electricity/point-charge-electric-field`,
      },
      {
        title: "Parallel Plate Electric Field",
        href: `${BASE_PATH}/static-electricity/parallel-plate-electric-field`,
      },
      {
        title: "Parallel Plate Capacitor",
        href: `${BASE_PATH}/static-electricity/parallel-plate-capacitor`,
      },
      {
        title: "Capacitor Circuit",
        href: `${BASE_PATH}/static-electricity/capacitor-circuit`,
      },
      {
        title: "Series Circuit",
        href: `${BASE_PATH}/static-electricity/series-circuit`,
      },
      {
        title: "Parallel Circuit",
        href: `${BASE_PATH}/static-electricity/parallel-circuit`,
      },
    ],
  },
  {
    title: "Direct Current",
    description:
      "Foundation of all electronic devices from smartphones to electric cars changing the world.",
    href: `${BASE_PATH}/direct-current`,
    items: [
      {
        title: "Electric Current",
        href: `${BASE_PATH}/direct-current/electric-current`,
      },
      {
        title: "Ohmic and Non-Ohmic Resistance",
        href: `${BASE_PATH}/direct-current/ohmic-non-ohmic-resistance`,
      },
      {
        title: "Resistivity",
        href: `${BASE_PATH}/direct-current/resistivity`,
      },
      {
        title: "Electric Circuit",
        href: `${BASE_PATH}/direct-current/electric-circuit`,
      },
      {
        title: "Compound Circuit",
        href: `${BASE_PATH}/direct-current/compound-circuit`,
      },
      {
        title: "Electric Power",
        href: `${BASE_PATH}/direct-current/electric-power`,
      },
    ],
  },
  {
    title: "Magnetism",
    description:
      "Mysterious force that guides compasses and powers electric motors in modern life.",
    href: `${BASE_PATH}/magnetism`,
    items: [
      {
        title: "Magnetic Field",
        href: `${BASE_PATH}/magnetism/magnetic-field`,
      },
      {
        title: "Force on Moving Charge",
        href: `${BASE_PATH}/magnetism/force-moving-charge`,
      },
      {
        title: "Magnetic Force on Current-Carrying Conductor",
        href: `${BASE_PATH}/magnetism/force-current-carrying-conductor`,
      },
      {
        title: "Electric Motor",
        href: `${BASE_PATH}/magnetism/electric-motor`,
      },
      {
        title: "Magnetic Induction",
        href: `${BASE_PATH}/magnetism/magnetic-induction`,
      },
      {
        title: "Magnetic Field Around Straight Wire",
        href: `${BASE_PATH}/magnetism/magnetic-field-straight-wire`,
      },
      {
        title: "Current-Carrying Circular Wire",
        href: `${BASE_PATH}/magnetism/current-carrying-circular-wire`,
      },
      {
        title: "Solenoid",
        href: `${BASE_PATH}/magnetism/solenoid`,
      },
      {
        title: "Induced EMF",
        href: `${BASE_PATH}/magnetism/induced-emf`,
      },
      {
        title: "Magnetic Flux",
        href: `${BASE_PATH}/magnetism/magnetic-flux`,
      },
      {
        title: "Induced EMF Magnitude",
        href: `${BASE_PATH}/magnetism/induced-emf-magnitude`,
      },
      {
        title: "Generator",
        href: `${BASE_PATH}/magnetism/generator`,
      },
      {
        title: "Inductance",
        href: `${BASE_PATH}/magnetism/inductance`,
      },
      {
        title: "Transformer",
        href: `${BASE_PATH}/magnetism/transformer`,
      },
    ],
  },
  {
    title: "Alternating Current",
    description:
      "Revolutionary technology that brings electricity to homes around the world.",
    href: `${BASE_PATH}/alternating-current`,
    items: [
      {
        title: "Alternating Current Equation",
        href: `${BASE_PATH}/alternating-current/alternating-current-equation`,
      },
      {
        title: "Resistor",
        href: `${BASE_PATH}/alternating-current/resistor`,
      },
      {
        title: "Inductor",
        href: `${BASE_PATH}/alternating-current/inductor`,
      },
      {
        title: "Capacitor",
        href: `${BASE_PATH}/alternating-current/capacitor`,
      },
      {
        title: "RLC Circuit",
        href: `${BASE_PATH}/alternating-current/rlc-circuit`,
      },
      {
        title: "Circuit Resonance",
        href: `${BASE_PATH}/alternating-current/resonance-circuit`,
      },
    ],
  },
  {
    title: "Electromagnetic Waves",
    description:
      "Invisible spectrum that enables WiFi, radio, and X-rays to transform civilization.",
    href: `${BASE_PATH}/electromagnetic-wave`,
    items: [
      {
        title: "Electromagnetic Wave Propagation",
        href: `${BASE_PATH}/electromagnetic-wave/propagation`,
      },
      {
        title: "Electromagnetic Wave Spectrum",
        href: `${BASE_PATH}/electromagnetic-wave/spectrum`,
      },
      {
        title: "Electromagnetic Wave Energy",
        href: `${BASE_PATH}/electromagnetic-wave/energy`,
      },
      {
        title: "Gamma Rays and X-Rays",
        href: `${BASE_PATH}/electromagnetic-wave/gamma-x-ray`,
      },
      {
        title: "Ultraviolet Rays",
        href: `${BASE_PATH}/electromagnetic-wave/ultraviolet-ray`,
      },
      {
        title: "Visible Light",
        href: `${BASE_PATH}/electromagnetic-wave/visible-light`,
      },
      {
        title: "Infrared Rays",
        href: `${BASE_PATH}/electromagnetic-wave/infrared-ray`,
      },
      {
        title: "Microwaves",
        href: `${BASE_PATH}/electromagnetic-wave/microwave`,
      },
      {
        title: "Radio Waves",
        href: `${BASE_PATH}/electromagnetic-wave/radio-wave`,
      },
    ],
  },
  {
    title: "Introduction to Electronic Systems",
    description:
      "Gateway to digital technology that transforms the world from LEDs to modern computers.",
    href: `${BASE_PATH}/electronic-systems`,
    items: [
      {
        title: "Electronic Systems",
        href: `${BASE_PATH}/electronic-systems/electronic-system`,
      },
      {
        title: "Semiconductors",
        href: `${BASE_PATH}/electronic-systems/semiconductor`,
      },
      {
        title: "Light-Emitting Diode (LED)",
        href: `${BASE_PATH}/electronic-systems/led`,
      },
      {
        title: "Transistor",
        href: `${BASE_PATH}/electronic-systems/transistor`,
      },
      {
        title: "Integrated Circuit (IC)",
        href: `${BASE_PATH}/electronic-systems/integrated-circuit`,
      },
      {
        title: "Logic Gate Principles",
        href: `${BASE_PATH}/electronic-systems/logic-gate`,
      },
    ],
  },
  {
    title: "Relativity",
    description:
      "Einstein's revolutionary theory revealing secrets of space, time, and speed of light.",
    href: `${BASE_PATH}/relativity`,
    items: [
      {
        title: "Newtonian Relative Motion",
        href: `${BASE_PATH}/relativity/newtonian-relative-motion`,
      },
      {
        title: "Einstein's Relativity",
        href: `${BASE_PATH}/relativity/einstein-relativity`,
      },
      {
        title: "Time Dilation",
        href: `${BASE_PATH}/relativity/time-dilation`,
      },
      {
        title: "Velocity Addition",
        href: `${BASE_PATH}/relativity/velocity-addition`,
      },
    ],
  },
  {
    title: "Quantum Phenomena",
    description:
      "Strange world of particles enabling lasers, LEDs, and future quantum computers.",
    href: `${BASE_PATH}/quantum-phenomena`,
    items: [
      {
        title: "Photon Concept",
        href: `${BASE_PATH}/quantum-phenomena/photon-concept`,
      },
      {
        title: "Black Body Radiation",
        href: `${BASE_PATH}/quantum-phenomena/black-body-radiation`,
      },
      {
        title: "Wien's Displacement",
        href: `${BASE_PATH}/quantum-phenomena/wien-shift`,
      },
      {
        title: "Planck's Quantum Theory",
        href: `${BASE_PATH}/quantum-phenomena/planck-quantum-theory`,
      },
      {
        title: "Photoelectric Effect",
        href: `${BASE_PATH}/quantum-phenomena/photoelectric-effect`,
      },
      {
        title: "Compton Effect",
        href: `${BASE_PATH}/quantum-phenomena/compton-effect`,
      },
      {
        title: "X-Rays",
        href: `${BASE_PATH}/quantum-phenomena/x-ray`,
      },
    ],
  },
  {
    title: "Nuclear Physics and Radioactivity",
    description:
      "Tremendous atomic power that energizes stars and modern medical technology.",
    href: `${BASE_PATH}/nuclear-physics`,
    items: [
      {
        title: "Discovery of Atomic Nucleus",
        href: `${BASE_PATH}/nuclear-physics/discovery-atomic-nucleus`,
      },
      {
        title: "History of Atomic Nucleus Discovery",
        href: `${BASE_PATH}/nuclear-physics/history-discovery-atomic-nucleus`,
      },
      {
        title: "Characteristics of Atomic Nucleus",
        href: `${BASE_PATH}/nuclear-physics/characteristics-atomic-nucleus`,
      },
      {
        title: "Mass Defect and Binding Energy",
        href: `${BASE_PATH}/nuclear-physics/mass-energy-binding-energy`,
      },
      {
        title: "Radioactivity",
        href: `${BASE_PATH}/nuclear-physics/radioactivity`,
      },
      {
        title: "Radiation Particles",
        href: `${BASE_PATH}/nuclear-physics/radiation-particles`,
      },
      {
        title: "Alpha Decay",
        href: `${BASE_PATH}/nuclear-physics/alpha-decay`,
      },
      {
        title: "Beta Decay",
        href: `${BASE_PATH}/nuclear-physics/beta-decay`,
      },
      {
        title: "Gamma Ray Radiation",
        href: `${BASE_PATH}/nuclear-physics/gamma-ray`,
      },
      {
        title: "Beta Plus Decay",
        href: `${BASE_PATH}/nuclear-physics/beta-plus-decay`,
      },
      {
        title: "Nuclear Reaction",
        href: `${BASE_PATH}/nuclear-physics/nuclear-reaction`,
      },
      {
        title: "Fission Reaction",
        href: `${BASE_PATH}/nuclear-physics/fission-reaction`,
      },
      {
        title: "Fusion Reaction",
        href: `${BASE_PATH}/nuclear-physics/fusion-reaction`,
      },
    ],
  },
] as const;

export default enMaterials;
