/**
 * A motor neuron, its myelin and the muscle it drives, as fresh tissue looks
 * under a dissecting light, with the cut face of the cell body coloured as a
 * Nissl stain shows it: violet clumps of rough reticulum around a pale
 * nucleus and a dark nucleolus. A simulation that shows nerve tissue takes
 * its colours from here, so it looks the same in every lesson.
 */
export const NEURON_COLORS = {
  // The neuron: its membrane, the axoplasm, and the stained cut face.
  axoplasm: "#c98f80",
  cytoplasm: "#e7c7c0",
  envelope: "#a98fb6",
  neurite: "#d4a294",
  nissl: "#5f3f86",
  nucleolus: "#3c2152",
  nucleus: "#efe4ec",

  // Myelin: compact lamellae, the dense lines between them, and the Schwann cell.
  lamella: "#e9dcc4",
  denseLine: "#c9bba6",
  remak: "#e7dccb",
  schwann: "#e2d0bd",
  schwannNucleus: "#9d86ad",

  // Skeletal muscle under the end plates.
  myonucleus: "#6d3f5c",
  sarcoplasm: "#a3514b",
  solePlate: "#dba79b",

  // The impulse: the local current, the depolarised membrane, the
  // undershoot, and the ions that cross.
  current: "#ffd84d",
  depolarised: "#ff8a3d",
  potassium: "#a487ff",
  sodium: "#ffc53d",
  undershoot: "#6f92ff",

  // The soft light each tissue scatters at grazing angles: a membrane, myelin,
  // Nissl substance and sarcoplasm.
  membraneSheen: "#ffe2d8",
  myelinSheen: "#fff1d6",
  nisslSheen: "#c9a8ff",
  sarcoplasmSheen: "#ffb1a3",

  // The recording electrode: a pulled glass pipette and its chloride-coated silver wire.
  chloride: "#7c736c",
  pipette: "#e9f5f8",
} as const;
