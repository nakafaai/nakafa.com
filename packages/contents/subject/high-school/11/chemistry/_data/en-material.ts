import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Atomic Structure and Periodic Table",
    description:
      "Secret map of the universe revealing how elements compose our world.",
    href: `${BASE_PATH}/atomic-structure-periodic-table`,
    items: [
      {
        title: "Atomic Structure",
        href: `${BASE_PATH}/atomic-structure-periodic-table/structure-atom`,
      },
      {
        title: "Quantum Mechanics Atomic Theory",
        href: `${BASE_PATH}/atomic-structure-periodic-table/quantum-mechanics-theory`,
      },
      {
        title: "Periodic Table System",
        href: `${BASE_PATH}/atomic-structure-periodic-table/periodic-table`,
      },
      {
        title: "Periodic Properties of Elements",
        href: `${BASE_PATH}/atomic-structure-periodic-table/periodic-properties`,
      },
    ],
  },
  {
    title: "Chemical Bonding",
    description:
      "Hidden forces that unite atoms creating everything from water to diamonds.",
    href: `${BASE_PATH}/chemical-bonding`,
    items: [
      {
        title: "Basics of Chemical Bonding",
        href: `${BASE_PATH}/chemical-bonding/basic-chemical-bonding`,
      },
      {
        title: "Ionic Bonding",
        href: `${BASE_PATH}/chemical-bonding/ionic-bonding`,
      },
      {
        title: "Covalent Bonding",
        href: `${BASE_PATH}/chemical-bonding/covalent-bonding`,
      },
      {
        title: "Metallic Bonding",
        href: `${BASE_PATH}/chemical-bonding/metallic-bonding`,
      },
      {
        title: "Molecular Shape",
        href: `${BASE_PATH}/chemical-bonding/molecular-shape`,
      },
      {
        title: "Intermolecular Bonding",
        href: `${BASE_PATH}/chemical-bonding/intermolecular-bonding`,
      },
    ],
  },
  {
    title: "Stoichiometry",
    description:
      "Chemistry mathematics enabling accurate predictions in drug and food production.",
    href: `${BASE_PATH}/stoichiometry`,
    items: [
      {
        title: "Definition of Stoichiometry",
        href: `${BASE_PATH}/stoichiometry/definition`,
      },
      {
        title: "Mole Concept",
        href: `${BASE_PATH}/stoichiometry/mol-concept`,
      },
      {
        title: "Molecular and Empirical Formulas",
        href: `${BASE_PATH}/stoichiometry/molecular-empirical-formula`,
      },
      {
        title: "Limiting Reagent",
        href: `${BASE_PATH}/stoichiometry/limiting-reagent`,
      },
      {
        title: "Percentage Yield",
        href: `${BASE_PATH}/stoichiometry/percentage-yield`,
      },
      {
        title: "Percentage Purity",
        href: `${BASE_PATH}/stoichiometry/percentage-purity`,
      },
    ],
  },
  {
    title: "Hydrocarbons",
    description:
      "Vital energy source from plastics to fuels that drive modern civilization.",
    href: `${BASE_PATH}/hydrocarbon`,
    items: [
      {
        title: "Carbon Atom Characteristics",
        href: `${BASE_PATH}/hydrocarbon/carbon-atom-characteristics`,
      },
      {
        title: "Hydrocarbon Classification",
        href: `${BASE_PATH}/hydrocarbon/classification`,
      },
      {
        title: "Alkanes",
        href: `${BASE_PATH}/hydrocarbon/alkane`,
      },
      {
        title: "Alkenes and Alkynes",
        href: `${BASE_PATH}/hydrocarbon/alkene-alkyne`,
      },
      {
        title: "Aromatic Hydrocarbons",
        href: `${BASE_PATH}/hydrocarbon/aromatic-hydrocarbon`,
      },
      {
        title: "Physical and Chemical Properties of Hydrocarbons",
        href: `${BASE_PATH}/hydrocarbon/physical-chemical-properties`,
      },
      {
        title: "Isomers in Hydrocarbons",
        href: `${BASE_PATH}/hydrocarbon/isomer`,
      },
      {
        title: "Impact of Hydrocarbon Combustion",
        href: `${BASE_PATH}/hydrocarbon/combustion-impacts`,
      },
    ],
  },
  {
    title: "Thermochemistry",
    description:
      "Study of energy in chemical reactions explaining why wood burns and ice melts.",
    href: `${BASE_PATH}/thermochemistry`,
    items: [
      {
        title: "Law of Conservation of Energy",
        href: `${BASE_PATH}/thermochemistry/law-conservation-energy`,
      },
      {
        title: "System and Environment",
        href: `${BASE_PATH}/thermochemistry/system-environment`,
      },
      {
        title: "Exothermic and Endothermic Reactions",
        href: `${BASE_PATH}/thermochemistry/exothermic-endothermic-reactions`,
      },
      {
        title: "Calorimetry",
        href: `${BASE_PATH}/thermochemistry/calorimetry`,
      },
      {
        title: "Enthalpy and Enthalpy Change",
        href: `${BASE_PATH}/thermochemistry/enthalpy-enthalpy-change`,
      },
      {
        title: "Thermochemical Equations",
        href: `${BASE_PATH}/thermochemistry/thermochemical-equation`,
      },
      {
        title: "Enthalpy Change in Standard State",
        href: `${BASE_PATH}/thermochemistry/enthalpy-standard-state`,
      },
      {
        title: "Hess's Law",
        href: `${BASE_PATH}/thermochemistry/hess-law`,
      },
      {
        title: "Bond Energy",
        href: `${BASE_PATH}/thermochemistry/bond-energy`,
      },
    ],
  },
  {
    title: "Chemical Kinetics",
    description:
      "Revealing reaction speeds to optimize industrial production and pharmaceuticals.",
    href: `${BASE_PATH}/kinetic-chemistry`,
    items: [
      {
        title: "Collision Theory",
        href: `${BASE_PATH}/kinetic-chemistry/collision-theory`,
      },
      {
        title: "Reaction Rate",
        href: `${BASE_PATH}/kinetic-chemistry/reaction-rate`,
      },
      {
        title: "Rate Equations and Reaction Order",
        href: `${BASE_PATH}/kinetic-chemistry/reaction-rate-equation-order`,
      },
      {
        title: "Factors Affecting Reaction Rate",
        href: `${BASE_PATH}/kinetic-chemistry/factors-affecting-reaction-rate`,
      },
    ],
  },
  {
    title: "Chemical Equilibrium",
    description:
      "Dynamic harmony in reactions enabling precise control in chemical synthesis.",
    href: `${BASE_PATH}/chemical-equilibrium`,
    items: [
      {
        title: "Chemical Equilibrium Concept",
        href: `${BASE_PATH}/chemical-equilibrium/concept`,
      },
      {
        title: "Equilibrium Constant",
        href: `${BASE_PATH}/chemical-equilibrium/equilibrium-constant`,
      },
      {
        title: "Using Equilibrium Constants in Calculations",
        href: `${BASE_PATH}/chemical-equilibrium/equilibrium-constant-calculations`,
      },
      {
        title: "Equilibrium Shift",
        href: `${BASE_PATH}/chemical-equilibrium/equilibrium-shift`,
      },
      {
        title: "Chemical Equilibrium in Industry",
        href: `${BASE_PATH}/chemical-equilibrium/industrial-applications`,
      },
    ],
  },
] as const;

export default enMaterials;
