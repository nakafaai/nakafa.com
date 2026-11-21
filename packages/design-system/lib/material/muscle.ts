/**
 * Living skeletal muscle at tissue scale and the blood that runs through it:
 * fibres, their bands and nuclei, the connective tissue round them,
 * capillaries, red blood cells, and the oxygen and lactic acid they trade.
 * A lab or a trace that shows one of them takes its colour from here, so the
 * scene and the card read as one.
 */
export const MUSCLE_COLORS = {
  /** The A band of a living fibre, where thick filaments lie: the darker stripe. */
  aBand: "#7c1c27",
  /** Collagen of the perimysium round a fascicle: a pearly, translucent white. */
  collagen: "#eadad0",
  /** The cut face of a fibre, sarcoplasm between myofibrils. */
  cut: "#8f2a34",
  /** The thin wall of a capillary, endothelium over its basement membrane. */
  endothelium: "#f0c4bb",
  /** The I band, thin filaments alone: the paler stripe. */
  iBand: "#ad454c",
  /** Lactic acid, in the scene, the gauge, and the shaded shortfall. */
  lactate: "#e8992a",
  /** A myonucleus seen through the sarcolemma. */
  nucleus: "#6e3b5c",
  /** Oxygen, in the scene, the uptake trace, and the shaded debt. */
  oxygen: "#2f8fd8",
  /** A red blood cell full of oxygen, as it enters a capillary. */
  oxygenated: "#cf1f2b",
  /** A red blood cell that has given up much of its oxygen. */
  reduced: "#8a1626",
  /** The sheen of the endomysium over each fibre. */
  sheath: "#f6dcd4",
} as const;
