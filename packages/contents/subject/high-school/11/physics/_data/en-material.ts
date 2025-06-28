import type { MaterialList } from "@repo/contents/_types/subject/material";
import { BASE_PATH } from ".";

const enMaterials: MaterialList = [
  {
    title: "Vectors",
    description:
      "Mathematical language to describe direction and magnitude in 3D world, from GPS to gaming.",
    href: `${BASE_PATH}/vector`,
    items: [
      {
        title: "Vector Concept",
        href: `${BASE_PATH}/vector/concept`,
      },
      {
        title: "Vector Symbols and Notation",
        href: `${BASE_PATH}/vector/notation`,
      },
      {
        title: "Vector Properties",
        href: `${BASE_PATH}/vector/property`,
      },
      {
        title: "Vector Components",
        href: `${BASE_PATH}/vector/component`,
      },
      {
        title: "Vector Decomposition Using Trigonometry Rules",
        href: `${BASE_PATH}/vector/trigonometry-decomposition`,
      },
      {
        title: "Vector Addition and Subtraction with Graphical Method",
        href: `${BASE_PATH}/vector/graphical-addition-subtraction`,
      },
      {
        title: "Vector Addition and Subtraction with Analytical Method",
        href: `${BASE_PATH}/vector/analytical-addition-subtraction`,
      },
      {
        title: "Determining Vector Resultant with Cosine Rule",
        href: `${BASE_PATH}/vector/cosine-rule`,
      },
      {
        title: "Determining Vector Resultant Direction with Sine Rule",
        href: `${BASE_PATH}/vector/sine-rule`,
      },
      {
        title: "Vector Multiplication",
        href: `${BASE_PATH}/vector/multiplication`,
      },
    ],
  },
  {
    title: "Kinematics",
    description:
      "The art of predicting motion from bullets to satellites without caring about the cause.",
    href: `${BASE_PATH}/kinematics`,
    items: [
      {
        title: "Reference Frame and Position",
        href: `${BASE_PATH}/kinematics/reference-frame-position`,
      },
      {
        title: "Motion as Position Change",
        href: `${BASE_PATH}/kinematics/movement-position-change`,
      },
      {
        title: "Displacement and Distance",
        href: `${BASE_PATH}/kinematics/displacement-distance`,
      },
      {
        title: "Velocity and Speed",
        href: `${BASE_PATH}/kinematics/velocity-speed`,
      },
      {
        title: "Relative Motion",
        href: `${BASE_PATH}/kinematics/relative-movement`,
      },
      {
        title: "Instantaneous Velocity and Speed",
        href: `${BASE_PATH}/kinematics/instantaneous-velocity-speed`,
      },
      {
        title: "Average Velocity and Speed",
        href: `${BASE_PATH}/kinematics/average-velocity-speed`,
      },
      {
        title: "Acceleration",
        href: `${BASE_PATH}/kinematics/acceleration`,
      },
      {
        title: "Uniform Linear Motion",
        href: `${BASE_PATH}/kinematics/uniform-linear-motion`,
      },
      {
        title: "Uniformly Accelerated Linear Motion",
        href: `${BASE_PATH}/kinematics/uniform-linear-motion`,
      },
      {
        title: "Stopping Distance",
        href: `${BASE_PATH}/kinematics/stopping-distance`,
      },
      {
        title: "Vertical Motion",
        href: `${BASE_PATH}/kinematics/vertical-movement`,
      },
      {
        title: "Parabolic Motion",
        href: `${BASE_PATH}/kinematics/parabolic-movement`,
      },
      {
        title: "Parabolic Motion Analysis",
        href: `${BASE_PATH}/kinematics/parabolic-movement-analysis`,
      },
      {
        title: "Uniform Circular Motion",
        href: `${BASE_PATH}/kinematics/uniform-circular-motion`,
      },
    ],
  },
  {
    title: "Particle Dynamics",
    description:
      "The secret behind every movement, from rockets launching to cars turning safely.",
    href: `${BASE_PATH}/particle-dynamics`,
    items: [
      {
        title: "Newton's First Law",
        href: `${BASE_PATH}/particle-dynamics/newton-first-law`,
      },
      {
        title: "Newton's Second Law",
        href: `${BASE_PATH}/particle-dynamics/newton-second-law`,
      },
      {
        title: "Newton's Third Law",
        href: `${BASE_PATH}/particle-dynamics/newton-third-law`,
      },
      {
        title: "Weight Force",
        href: `${BASE_PATH}/particle-dynamics/weight-force`,
      },
      {
        title: "Normal Force",
        href: `${BASE_PATH}/particle-dynamics/normal-force`,
      },
      {
        title: "Solid Friction Force",
        href: `${BASE_PATH}/particle-dynamics/solid-friction`,
      },
      {
        title: "Fluid Friction Force",
        href: `${BASE_PATH}/particle-dynamics/fluid-friction`,
      },
      {
        title: "Centripetal Force",
        href: `${BASE_PATH}/particle-dynamics/centripetal-force`,
      },
      {
        title: "Law of Conservation of Momentum",
        href: `${BASE_PATH}/particle-dynamics/momentum-conservation`,
      },
      {
        title: "Types of Collisions",
        href: `${BASE_PATH}/particle-dynamics/collision-types`,
      },
      {
        title: "Rotational Motion",
        href: `${BASE_PATH}/particle-dynamics/rotational-motion`,
      },
      {
        title: "Torque",
        href: `${BASE_PATH}/particle-dynamics/torque`,
      },
      {
        title: "Moment of Inertia",
        href: `${BASE_PATH}/particle-dynamics/inertia-moment`,
      },
    ],
  },
  {
    title: "Fluids",
    description:
      "Science that reveals the mystery of flowing liquids and moving gases in daily life.",
    href: `${BASE_PATH}/fluid`,
    items: [
      {
        title: "Static Fluids",
        href: `${BASE_PATH}/fluid/static-fluid`,
      },
      {
        title: "Hydrostatic Pressure",
        href: `${BASE_PATH}/fluid/hydrostatic-pressure`,
      },
      {
        title: "Archimedes' Principle",
        href: `${BASE_PATH}/fluid/archimedes-principle`,
      },
      {
        title: "Surface Tension",
        href: `${BASE_PATH}/fluid/surface-tension`,
      },
      {
        title: "Viscosity",
        href: `${BASE_PATH}/fluid/viscosity`,
      },
      {
        title: "Dynamic Fluids",
        href: `${BASE_PATH}/fluid/dynamic-fluid`,
      },
      {
        title: "Ideal Fluid",
        href: `${BASE_PATH}/fluid/ideal-fluid`,
      },
      {
        title: "Continuity Principle",
        href: `${BASE_PATH}/fluid/continuity-principle`,
      },
      {
        title: "Bernoulli's Equation",
        href: `${BASE_PATH}/fluid/bernoulli-equation`,
      },
      {
        title: "Bernoulli's Principle Application",
        href: `${BASE_PATH}/fluid/bernoulli-principle-application`,
      },
    ],
  },
  {
    title: "Waves, Sound, and Light",
    description:
      "Amazing phenomena that allow us to hear music and see the world around us.",
    href: `${BASE_PATH}/wave-sound-light`,
    items: [
      {
        title: "Waves",
        href: `${BASE_PATH}/wave-sound-light/wave`,
      },
      {
        title: "Types of Waves",
        href: `${BASE_PATH}/wave-sound-light/wave-types`,
      },
      {
        title: "Wave Principles",
        href: `${BASE_PATH}/wave-sound-light/wave-principles`,
      },
      {
        title: "Sound Waves",
        href: `${BASE_PATH}/wave-sound-light/sound-wave`,
      },
      {
        title: "Speed of Sound",
        href: `${BASE_PATH}/wave-sound-light/sound-speed`,
      },
      {
        title: "Sound Source",
        href: `${BASE_PATH}/wave-sound-light/sound-source`,
      },
      {
        title: "Doppler Effect",
        href: `${BASE_PATH}/wave-sound-light/doppler-effect`,
      },
      {
        title: "Resonance",
        href: `${BASE_PATH}/wave-sound-light/resonance`,
      },
      {
        title: "Beat Sound",
        href: `${BASE_PATH}/wave-sound-light/beat-sound`,
      },
      {
        title: "Sound Intensity and Intensity Level",
        href: `${BASE_PATH}/wave-sound-light/intensity-intensity-level`,
      },
      {
        title: "Sound Wave Applications",
        href: `${BASE_PATH}/wave-sound-light/sound-wave-application`,
      },
      {
        title: "Light Waves",
        href: `${BASE_PATH}/wave-sound-light/light-wave`,
      },
      {
        title: "Light Interference",
        href: `${BASE_PATH}/wave-sound-light/interference-light`,
      },
      {
        title: "Light Diffraction",
        href: `${BASE_PATH}/wave-sound-light/diffraction-light`,
      },
      {
        title: "Polarization",
        href: `${BASE_PATH}/wave-sound-light/polarization`,
      },
      {
        title: "Light Wave Applications",
        href: `${BASE_PATH}/wave-sound-light/light-wave-application`,
      },
    ],
  },
  {
    title: "Heat",
    description:
      "Hidden energy that powers engines and warms our homes every day.",
    href: `${BASE_PATH}/heat`,
    items: [
      {
        title: "Temperature Definition and Measurement Tools",
        href: `${BASE_PATH}/heat/temperature-measurement`,
      },
      {
        title: "Temperature Scale",
        href: `${BASE_PATH}/heat/temperature-scale`,
      },
      {
        title: "Heat Definition",
        href: `${BASE_PATH}/heat/heat-definition`,
      },
      {
        title: "Heat Effect on Temperature Change",
        href: `${BASE_PATH}/heat/heat-effect-temperature-change`,
      },
      {
        title: "Heat Effect on Phase Change",
        href: `${BASE_PATH}/heat/heat-effect-phase-change`,
      },
      {
        title: "Heat Effect on Expansion",
        href: `${BASE_PATH}/heat/heat-effect-expansion`,
      },
      {
        title: "Conduction",
        href: `${BASE_PATH}/heat/conduction`,
      },
      {
        title: "Convection",
        href: `${BASE_PATH}/heat/convection`,
      },
      {
        title: "Radiation",
        href: `${BASE_PATH}/heat/radiation`,
      },
      {
        title: "Heat Transfer Applications",
        href: `${BASE_PATH}/heat/heat-transfer-application`,
      },
    ],
  },
  {
    title: "Thermodynamics",
    description:
      "Fundamental laws of the universe that govern engine efficiency and life itself.",
    href: `${BASE_PATH}/thermodynamics`,
    items: [
      {
        title: "Gas Definition",
        href: `${BASE_PATH}/thermodynamics/gas-definition`,
      },
      {
        title: "Gas Laws",
        href: `${BASE_PATH}/thermodynamics/gas-laws`,
      },
      {
        title: "Real Gas and Ideal Gas Law",
        href: `${BASE_PATH}/thermodynamics/real-ideal-gas`,
      },
      {
        title: "System and Environment",
        href: `${BASE_PATH}/thermodynamics/system-environment`,
      },
      {
        title: "Thermodynamic System Properties",
        href: `${BASE_PATH}/thermodynamics/system-properties`,
      },
      {
        title: "P-V Diagram",
        href: `${BASE_PATH}/thermodynamics/p-v-diagram`,
      },
      {
        title: "Work and Ideal Gas",
        href: `${BASE_PATH}/thermodynamics/work-ideal-gas`,
      },
      {
        title: "Four Thermodynamic Processes",
        href: `${BASE_PATH}/thermodynamics/four-thermodynamic-processes`,
      },
      {
        title: "Reversible and Irreversible Processes",
        href: `${BASE_PATH}/thermodynamics/reversible-irreversible-process`,
      },
      {
        title: "Zeroth Law of Thermodynamics",
        href: `${BASE_PATH}/thermodynamics/zeroth-law-thermodynamics`,
      },
      {
        title: "First Law of Thermodynamics",
        href: `${BASE_PATH}/thermodynamics/first-law-thermodynamics`,
      },
      {
        title: "First Law of Thermodynamics Applications",
        href: `${BASE_PATH}/thermodynamics/first-law-thermodynamics-application`,
      },
      {
        title: "Heat Capacity",
        href: `${BASE_PATH}/thermodynamics/heat-capacity`,
      },
      {
        title: "Second Law of Thermodynamics",
        href: `${BASE_PATH}/thermodynamics/second-law-thermodynamics`,
      },
      {
        title: "Heat Engine",
        href: `${BASE_PATH}/thermodynamics/heat-engine`,
      },
      {
        title: "Heat Pump",
        href: `${BASE_PATH}/thermodynamics/heat-pump`,
      },
    ],
  },
] as const;

export default enMaterials;
