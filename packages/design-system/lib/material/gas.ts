/**
 * The gas lab's apparatus as a camera sees it: the gas in its glass
 * cylinder and its molecules, the plate under the cylinder that heats or
 * cools it, the water bath that holds its temperature, the foam jacket that
 * keeps heat out, the graph paper of the p-V board, and the digital
 * thermometer. A simulation that shows one of them takes its colour from
 * here, so it looks the same in every lesson.
 */
export const GAS_COLORS = {
  // The gas: a faint cool blue when cold, a faint amber when hot.
  gasCold: "#5f9ee0",
  gasHot: "#f08436",
  molecule: "#4f6f91",
  // The plate's face: dull steel at rest, glowing as it heats, frosting as it cools.
  plate: "#9aa1a8",
  plateHot: "#ff6a18",
  plateCold: "#7fd0ff",
  // Polyurethane foam, and the water of the bath.
  foam: "#d8b65e",
  water: "#a9d3e3",
  // The faint grid printed on the graph paper.
  grid: "#bcd8d2",
  // The thermometer's pale plastic case.
  meterCase: "#e4e2dc",
} as const;
