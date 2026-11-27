/**
 * The places of the ecology and climate labs: a soaking tub, rice fields and a town square, a reef tank, a
 * coastal kampung, the Sun and the air, a coast and a meadow floor.
 * A simulation that shows one of them takes its colour from here, so it looks the same in every lesson.
 */
export const ECOLOGY_COLORS = {
  // CarbonBudgetLab: an enamelled soaking tub, its bathwater, and its chrome
  // filler and waste.
  bathwater: "#9fd2d4",
  chromeShadow: "#3e444a",
  chromeSpecular: "#fbfcfd",
  porcelain: "#f4f1eb",
  porcelainDeep: "#8f8a80",
  porcelainGloss: "#fffefb",
  porcelainShade: "#cfcac0",

  // PredatorPreyLab and EpidemicSpreadLab: rice hills, a rice-field rat and a
  // barn owl seen from above; people, granite and a fountain in a town square.
  granite: "#6e6a64",
  hairBlack: "#1f1b18",
  owlFace: "#f6f1e6",
  owlGrey: "#9a958c",
  ratSkin: "#c49a8a",
  riceLeaf: "#6f8f37",
  riceLeafPale: "#b3b764",
  skin: "#c8916a",
  skinDeep: "#8c5a3b",
  surgicalMask: "#d6e7ee",

  // CoralBleachLab: the warm brown and golden olive that zooxanthellae give
  // two more colonies, dead coral rubble and grey reef rock on the white
  // aragonite sand, the 12 000 K white of a reef LED, the clear water and the
  // black film on the tank's back glass.
  coralBrown: "#6a4a2e",
  coralGold: "#7c6834",
  coralRubble: "#b9b09e",
  reefLight: "#dfe8ff",
  reefRock: "#8a8274",
  reefSand: "#ddd5c3",
  reefWater: "#cfe8f0",
  tankBackdrop: "#0c141b",

  // SeaLevelRiseLab: a Malaysian coastal kampung. Damp sand below the swash
  // line, tropical cow grass in sun and shade, the heartwoods of its stilt
  // houses (chengal, red meranti, silvered and fresh planks), a dried nipah
  // attap roof and a rusted zinc one, the dark rooms behind open shutters,
  // coconut palms green, yellowing and dead, and a painted fishing perahu.
  sandWet: "#a38d6a",
  grassLush: "#4f6b2f",
  grassSun: "#7d8446",
  woodChengal: "#5a3d27",
  woodMeranti: "#8a4f33",
  woodWeathered: "#7a6c5c",
  woodPale: "#a07a52",
  attap: "#7d6a48",
  zincRust: "#7b5440",
  roomShade: "#1f1a16",
  palmTrunk: "#857565",
  palmFrond: "#4c6a26",
  palmFrondTip: "#8a9a3e",
  palmFrondDead: "#9a7f4e",
  coconut: "#5f6e27",
  boatHull: "#2b6684",
  boatTrim: "#a63a2e",

  // GreenhouseEffectLab: the Sun's white core and its redder limb, its
  // corona, the sunlight it sends, the warm infrared the ground gives off,
  // and molecular models in the
  // satin tones of a real model kit: charcoal carbon, white hydrogen and a
  // brick red oxygen.
  sunCore: "#fff5e1",
  sunLimb: "#ffad4a",
  sunCorona: "#ffcf85",
  sunlight: "#fff2c8",
  infrared: "#ff6436",
  moleculeCarbon: "#3a3c40",
  moleculeHydrogen: "#ebe8e2",
  moleculeOxygen: "#c0392f",

  // A planet from orbit: the blue the air scatters toward an eye in space,
  // and the black of space behind the stars, a touch blue so it does not
  // read as a missing image.
  airScatter: "#4f8dff",
  spaceVoid: "#020308",

  // A coast, a reef tank and a meadow floor.
  coralBleached: "#f4f1ea",
  coralHealthy: "#6e6437",
  coralTip: "#a99a5e",
  fur: "#9b7b5b",
  furFox: "#b4552a",
  leafLitter: "#7b5a32",
  leafLitterDark: "#4e3a22",
  mangroveRoot: "#5b4632",
  mud: "#6d5d48",
  owlBack: "#e8dcc4",
  owlWing: "#c49a5a",
  owlWingTip: "#8f6e45",
  soybean: "#e9d6a4",
  soybeanEdge: "#c8ab70",
  soybeanFace: "#f3e6c2",
  seawater: "#2f6f7e",
  seawaterDeep: "#1d4c5c",
  stucco: "#ece4d4",
  timber: "#8a6a48",
} as const;
